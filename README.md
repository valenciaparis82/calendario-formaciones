# Calendario semanal · ASR e INMOVERSE

Calendario público en español con siete días (lunes a domingo), zona horaria **Europe/Madrid**, y administración mediante Supabase Auth y RLS. La agenda empieza vacía; no contiene actividades de ejemplo. El diseño toma como referencia la organización y los colores de `IMG-20261125-WA0006.jpg`, sin reutilizar su logotipo.

## Antes de conectar Supabase

La web funciona como vista previa sin credenciales, pero muestra un aviso de configuración y **no permite guardar ni simula datos**. El acceso de administración está en `/admin`; la vista pública `/` no muestra controles de edición ni enlace al panel.

### Pasos en tu proyecto Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard). No compartas aquí la contraseña de la base de datos, la contraseña del administrador ni la clave `service_role`/`secret`.
2. En **Authentication → Users**, crea la cuenta de correo del administrador (puedes usar **Add user**). Copia su **User UID** (UUID); necesitarás ese identificador para autorizarla. Si el panel ofrece confirmar el correo, confírmalo al crearla.
3. En **Authentication → Providers → Email**, desactiva el registro público (**Allow new users to sign up**) si no necesitas dar de alta cuentas desde fuera del panel. La aplicación no ofrece registro. El inicio de sesión por contraseña debe permanecer habilitado.
4. Abre **SQL Editor** y ejecuta `supabase/migrations/20261125000000_initial_calendar.sql`. Esto crea la tabla, lista privada de administradores, función y políticas RLS. **No pegues nunca la contraseña en SQL.**
5. Todavía en **SQL Editor**, sustituye el UUID por el User UID real y ejecuta:
   ```sql
   insert into private.admin_users (user_id)
   values ('UUID-DEL-ADMINISTRADOR');
   ```
   Esta lista no admite escritura desde el navegador. Para retirar el acceso, elimina esa fila desde SQL Editor.
6. En **Project Settings → API** (o **Connect**), copia **Project URL** y la clave pública **Publishable key** (`sb_publishable_...`). Si tu proyecto todavía usa la clave pública `anon`, también sirve. **Nunca uses `service_role` ni `sb_secret_...` en Vite.**
7. Copia `.env.example` a `.env.local`, reemplaza los dos valores y reinicia el servidor de Vite. `VITE_` significa que el valor es visible en el navegador: solo se admiten la URL y la clave pública.

No hace falta introducir el UUID del administrador en el frontend: la autorización se consulta en la base de datos mediante `public.is_admin()` y se aplica de nuevo en **cada operación de escritura por RLS**. El almacenamiento de sesión de Supabase Auth en el navegador no sustituye a la base de datos; las actividades se guardan en Supabase.

## Arrancar y comprobar

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite (normalmente `http://localhost:5173/`). La administración está en `http://localhost:5173/admin`. Para comprobar compilación y pruebas unitarias:

```bash
npm run build
npm test
```

Tras configurar Supabase: accede a `/admin` con la cuenta autorizada; añade una actividad con fecha, horas, título y enlace; recarga `/` y comprueba que aparece; edítala, comprueba el nuevo contenido y después elimínala con confirmación. Repite la consulta desde otro dispositivo. Comprueba también que un usuario sin autorización no puede escribir aunque invoque la API directamente: el control real está en RLS.

## Despliegue posterior (no se publica automáticamente)

En Cloudflare Pages configura **Build command:** `npm run build`, **Build output directory:** `dist`; añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` como variables de entorno públicas. `public/_redirects` permite entrar directamente en `/admin`. Crea las mismas variables para Preview y Production según corresponda. En Supabase Authentication → URL Configuration, configura la URL del sitio al desplegar (para flujos de correo futuros). No hay pagos, reservas, chat, notificaciones ni registro público.

## Estructura

- `src/lib/dates.ts`: semanas y fechas de Madrid sin depender de la zona del navegador.
- `src/lib/activities.ts`: modelo, paleta y validación de formulario.
- `src/lib/data.ts`: única capa de acceso a Supabase.
- `src/App.tsx`: vistas pública y administrativa.
- `supabase/migrations/`: esquema, privilegios y políticas RLS.

**Pendiente de verificación con el proyecto conectado:** ejecución efectiva de la migración, acceso con la cuenta administradora, persistencia entre dispositivos, denegación RLS a usuarios no autorizados y configuración de Cloudflare Pages. Una compilación local sin credenciales no demuestra ninguna de esas operaciones.
