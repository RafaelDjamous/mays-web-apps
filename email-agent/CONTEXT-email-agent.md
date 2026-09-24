# Agente de Ventas por Correo — Contexto y Setup

Módulo dentro de `mays-web-apps` (carpeta `email-agent/`) que revisa el Outlook
de Rafi, clasifica correos de clientes y genera borradores de respuesta con
Claude. **Nada se envía automáticamente en esta versión (MVP)** — todo queda
como borrador en Outlook. Cuando el correo es de un cliente nuevo o una queja,
además se envía un aviso corto a Rafi para que lo revise con prioridad.

Es un servicio independiente (tiene su propio `package.json` y arranca solo),
desplegado por separado en Render — no comparte proceso con `apertura-credito`.

## 1. Estructura de esta carpeta

```
email-agent/
  index.js                        → arranca el server Express + el cron
  package.json
  server/emailAgent/
    graphClient.js   → llamadas a Microsoft Graph (leer/crear borradores/notificar)
    classifier.js    → llamada a la API de Claude (clasifica + redacta)
    runner.js        → ciclo principal: trae correos, clasifica, crea borrador
    scheduler.js     → cron cada 30 min
    routes.js        → API: GET /logs, POST /run
    storage.js       → log en JSON (data/email-agent-log.json)
  public/email-agent/dashboard.html → panel simple para ver lo procesado
```

## 2. App registrada en Azure AD (Entra ID) — YA HECHO

La app `Mays-email-agent` ya existe en el tenant de MAYS, con los permisos de
Graph aprobados por Oscar (Mail.Read, Mail.ReadWrite, Mail.Send — consentimiento
de administrador concedido el 2026-09-24):

- Client ID: `c5550fa7-0668-4509-a750-2bfeb85e59a1`
- Tenant ID: `f4ef5ab4-3cc4-4e30-b2ab-7f6e8413f970`
- Client Secret: generado, guardado fuera del repo (ver variables de entorno)

No hace falta volver a crear nada de esto en Azure AD/Entra ID — esa parte no
depende de dónde se hostee el código.

## 3. Variables de entorno (configurar en Render, no en un `.env` local)

```
AZURE_CLIENT_ID=c5550fa7-0668-4509-a750-2bfeb85e59a1
AZURE_TENANT_ID=f4ef5ab4-3cc4-4e30-b2ab-7f6e8413f970
AZURE_CLIENT_SECRET=<el secreto generado en Azure>
MAILBOX_USER_ID=rdjamous@mayszl.com
ANTHROPIC_API_KEY=<tu API key de Anthropic>
```

## 4. Desplegar en Render

MAYS no tiene una suscripción de Azure activa (solo Microsoft 365), así que el
hosting se hace en Render en vez de Azure App Service:

1. render.com → **New Web Service** → conectar el repo `mays-web-apps`
2. **Root Directory**: `email-agent` (importante — el repo tiene más de un
   proyecto; sin esto Render intenta correr desde la raíz y falla)
3. **Runtime**: Node
4. **Build Command**: `npm install`
5. **Start Command**: `npm start` (equivale a `node index.js`)
6. **Instance Type**: Free
7. Agregar las variables de entorno de la sección 3
8. Deploy — Render da una URL tipo `https://mays-email-agent.onrender.com`

Dashboard: `https://mays-email-agent.onrender.com/email-agent/dashboard.html`

### Mantenerlo despierto (plan Free)

El plan Free de Render duerme el servicio tras 15 min sin tráfico HTTP, lo cual
pararía el cron interno. Solución: crear un monitor gratis en uptimerobot.com
que le haga ping a la URL del dashboard cada 10 minutos.

## 5. Reglas actuales (definidas 2026-09-15, vigentes)

- Ninguna categoría se envía sola todavía — todo es borrador.
- `cliente_nuevo` y `queja` generan además un correo de aviso a Rafi.
- Cuando Rafi confíe en la calidad de los borradores de alguna categoría
  (ej. confirmaciones simples), se puede activar auto-envío solo para esa
  categoría, cambiando `runner.js` para llamar a un futuro
  `graph.sendReply()` en vez de solo crear el borrador.

## 6. Pendiente / siguientes pasos sugeridos

- [x] Registrar la app en Azure AD y conseguir las credenciales
- [x] Conseguir el consentimiento de administrador para los permisos de Graph
- [ ] Desplegar en Render con las variables de entorno de la sección 3
- [ ] Configurar UptimeRobot para mantener el servicio despierto
- [ ] Probar `POST /api/email-agent/run` manualmente antes de dejar el cron activo
- [ ] Dar contexto de catálogo/precios a `classifier.js` para cotizaciones más precisas
- [ ] Decidir canal de notificación (por ahora es un correo a ti mismo; se
      puede cambiar a Slack/WhatsApp si prefieres)
- [ ] Revisar los primeros borradores generados antes de confiar en el agente
      sin supervisión
