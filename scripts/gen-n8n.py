import json, uuid

def nid(): return str(uuid.uuid4())

APP = "={{ $('Config').first().json.appUrl }}"
EVO = "={{ $('Config').first().json.evolutionUrl }}"

def config_node(pos):
    return {"id": nid(), "name": "Config", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": pos,
        "parameters": {"assignments": {"assignments": [
            {"id": nid(), "name": "appUrl", "value": "https://TU-APP.vercel.app", "type": "string"},
            {"id": nid(), "name": "evolutionUrl", "value": "https://TU-EVOLUTION-API", "type": "string"}]},
            "options": {}},
        "notes": "Edita aquí la URL de la app en Vercel y la de Evolution API (sin / final)."}

def motor_http(name, path, body, pos):
    return {"id": nid(), "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": pos,
        "parameters": {"method": "POST", "url": "={{ $('Config').first().json.appUrl }}" + path,
            "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
            "sendBody": True, "specifyBody": "json", "jsonBody": body, "options": {"timeout": 60000}},
        "credentials": {"httpHeaderAuth": {"id": "", "name": "Prospección · x-motor-token"}}}

def send_nodes(x, y):
    split = {"id": nid(), "name": "Un envío por item", "type": "n8n-nodes-base.splitOut", "typeVersion": 1,
        "position": [x, y], "parameters": {"fieldToSplitOut": "envios", "options": {}}}
    cond = {"id": nid(), "name": "¿Lleva video?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [x + 220, y],
        "parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
            "conditions": [{"id": nid(), "leftValue": "={{ $json.mediaUrl }}", "rightValue": "",
                "operator": {"type": "string", "operation": "notEmpty", "singleValue": True}}], "combinator": "and"}, "options": {}}}
    def evo(name, path, body, yy):
        return {"id": nid(), "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [x + 460, yy],
            "parameters": {"method": "POST", "url": "={{ $('Config').first().json.evolutionUrl }}/message/" + path + "/{{ $json.instance }}",
                "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
                "sendBody": True, "specifyBody": "json", "jsonBody": body, "options": {"timeout": 30000}},
            "credentials": {"httpHeaderAuth": {"id": "", "name": "Evolution · apikey"}},
            "onError": "continueErrorOutput", "retryOnFail": True, "maxTries": 2, "waitBetweenTries": 3000}
    media = evo("Enviar video", "sendMedia",
        "={{ JSON.stringify({ number: $json.numero, mediatype: 'video', mimetype: 'video/mp4', media: $json.mediaUrl, caption: $json.texto, fileName: 'video.mp4' }) }}", y - 120)
    text = evo("Enviar texto", "sendText",
        "={{ JSON.stringify({ number: $json.numero, text: $json.texto }) }}", y + 120)
    fallo = motor_http("Reportar fallo", "/api/motor/fallo",
        "={{ JSON.stringify({ calendarId: $('Un envío por item').item.json.calendarId, eventId: $('Un envío por item').item.json.eventId, etapa: $('Un envío por item').item.json.etapa }) }}",
        [x + 720, y + 260])
    fallo["onError"] = "continueRegularOutput"
    nodes = [split, cond, media, text, fallo]
    conns = {
        split["name"]: {"main": [[{"node": cond["name"], "type": "main", "index": 0}]]},
        cond["name"]: {"main": [[{"node": media["name"], "type": "main", "index": 0}], [{"node": text["name"], "type": "main", "index": 0}]]},
        media["name"]: {"main": [[], [{"node": fallo["name"], "type": "main", "index": 0}]]},
        text["name"]: {"main": [[], [{"node": fallo["name"], "type": "main", "index": 0}]]},
    }
    return split["name"], nodes, conns

def workflow(name, nodes, conns):
    return {"name": name, "nodes": nodes, "connections": conns, "active": False,
        "settings": {"executionOrder": "v1", "timezone": "America/Bogota", "saveDataSuccessExecution": "none"},
        "pinData": {}, "tags": []}

# 01 Motor
trigger = {"id": nid(), "name": "Cada 5 minutos", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0],
    "parameters": {"rule": {"interval": [{"field": "minutes", "minutesInterval": 5}]}}}
cfg = config_node([220, 0])
tick = motor_http("Calcular etapas", "/api/motor/tick", "={{ JSON.stringify({}) }}", [440, 0])
first, sn, sc = send_nodes(660, 0)
conns = {trigger["name"]: {"main": [[{"node": "Config", "type": "main", "index": 0}]]},
    "Config": {"main": [[{"node": tick["name"], "type": "main", "index": 0}]]},
    tick["name"]: {"main": [[{"node": first, "type": "main", "index": 0}]]}, **sc}
json.dump(workflow("Prospección · 01 Motor", [trigger, cfg, tick] + sn, conns), open("n8n/01-motor.json", "w"), indent=2, ensure_ascii=False)

# 02 Respuestas
hook = {"id": nid(), "name": "Webhook Evolution", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0],
    "webhookId": nid(), "parameters": {"httpMethod": "POST", "path": "prospeccion-respuestas", "responseMode": "onReceived", "options": {}}}
cfg = config_node([220, 0])
filtro = {"id": nid(), "name": "¿Mensaje entrante?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [440, 0],
    "parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
        "conditions": [
            {"id": nid(), "leftValue": "={{ $('Webhook Evolution').item.json.body.event }}", "rightValue": "messages.upsert",
             "operator": {"type": "string", "operation": "equals"}},
            {"id": nid(), "leftValue": "={{ $('Webhook Evolution').item.json.body.data.key.fromMe }}", "rightValue": "",
             "operator": {"type": "boolean", "operation": "false", "singleValue": True}}],
        "combinator": "and"}, "options": {}}}
resp = motor_http("Interpretar respuesta", "/api/motor/respuesta",
    "={{ JSON.stringify($('Webhook Evolution').item.json.body) }}", [660, 0])
first, sn, sc = send_nodes(880, 0)
conns = {hook["name"]: {"main": [[{"node": "Config", "type": "main", "index": 0}]]},
    "Config": {"main": [[{"node": filtro["name"], "type": "main", "index": 0}]]},
    filtro["name"]: {"main": [[{"node": resp["name"], "type": "main", "index": 0}], []]},
    resp["name"]: {"main": [[{"node": first, "type": "main", "index": 0}]]}, **sc}
json.dump(workflow("Prospección · 02 Respuestas", [hook, cfg, filtro, resp] + sn, conns), open("n8n/02-respuestas.json", "w"), indent=2, ensure_ascii=False)
print("ok")
