# 🚗 Filtro Vehicular - Portal de Consultas

Portal profesional de consultas vehiculares y ciudadanas con integración de bots y métodos de pago.

## 🎯 Características

- ✅ **Responsive Design** - Adaptable a móvil, tablet y desktop
- ✅ **Tema Claro Minimalista** - UI limpia y profesional
- ✅ **2 Módulos Principales**:
  - 🚙 **Vehículos**: SUNARP, multas, verificaciones, SOAT
  - 👤 **Consultas**: RENIEC, SUNAT, antecedentes, migraciones
- ✅ **Integración con Bots** - Telegram, WhatsApp
- ✅ **Métodos de Pago** - Stripe, MercadoPago
- ✅ **API REST** - Backend escalable con TypeScript
- ✅ **Base de Datos** - PostgreSQL + Redis
- ✅ **Autenticación** - JWT + Roles de usuario
- ✅ **Tiempo Real** - WebSockets para notificaciones

## 🛠️ Stack Tecnológico

### Frontend
- React 18 + TypeScript
- Vite (Build tool)
- TailwindCSS (Styling)
- Shadcn/ui (Componentes)
- React Router (Navegación)
- Zustand (Estado global)
- React Query (Cache de datos)
- Socket.io Client (WebSockets)

### Backend
- Node.js + Express + TypeScript
- PostgreSQL (Base de datos)
- Prisma ORM
- Redis (Cache)
- BullMQ (Colas de trabajo)
- Socket.io (WebSockets)
- JWT (Autenticación)
- Zod (Validación)

## 📦 Instalación

### Requisitos Previos
- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker y Docker Compose (opcional)

### Instalación Local

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd "Filtro Vehicular +"
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. **Iniciar servicios con Docker**
```bash
npm run docker:up
```

5. **Generar Prisma Client**
```bash
npm run prisma:generate
```

6. **Ejecutar migraciones**
```bash
npm run prisma:migrate
```

7. **Iniciar en modo desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia frontend y backend
npm run dev:frontend     # Solo frontend
npm run dev:backend      # Solo backend

# Producción
npm run build            # Build de todo el proyecto
npm run build:frontend   # Build solo frontend
npm run build:backend    # Build solo backend
npm run start            # Inicia backend en producción

# Docker
npm run docker:up        # Inicia contenedores
npm run docker:down      # Detiene contenedores

# Base de datos
npm run prisma:generate  # Genera Prisma Client
npm run prisma:migrate   # Ejecuta migraciones
```

## 📁 Estructura del Proyecto

```
filtro-vehicular/
├── frontend/                 # Aplicación React
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   │   ├── ui/          # Componentes base (shadcn)
│   │   │   ├── layout/      # Header, Footer, Sidebar
│   │   │   └── shared/      # Componentes compartidos
│   │   ├── modules/         # Módulos principales
│   │   │   ├── vehiculos/   # Módulo de vehículos
│   │   │   └── consultas/   # Módulo de consultas
│   │   ├── services/        # API calls
│   │   ├── hooks/           # Custom hooks
│   │   ├── store/           # Zustand stores
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utilidades
│   │   └── App.tsx          # Componente principal
│   └── package.json
├── backend/                  # API Express
│   ├── src/
│   │   ├── routes/          # Rutas API
│   │   ├── controllers/     # Controladores
│   │   ├── services/        # Lógica de negocio
│   │   │   ├── bots/        # Servicios de bots
│   │   │   ├── payments/    # Servicios de pago
│   │   │   └── scrapers/    # Scrapers externos
│   │   ├── middleware/      # Middlewares
│   │   ├── models/          # Modelos Prisma
│   │   ├── utils/           # Utilidades
│   │   └── server.ts        # Servidor principal
│   ├── prisma/
│   │   └── schema.prisma    # Schema de BD
│   └── package.json
├── docker-compose.yml        # Configuración Docker
├── .env.example             # Variables de entorno
└── package.json             # Root package.json
```

## 🔐 Autenticación

El sistema usa JWT para autenticación. Roles disponibles:
- `USER` - Usuario básico
- `PREMIUM` - Usuario premium con más consultas
- `ADMIN` - Administrador del sistema

## 🤖 Integración con Bots

### Telegram Bot
Configurar `TELEGRAM_BOT_TOKEN` en `.env`

### WhatsApp Bot
Configurar `WHATSAPP_API_KEY` en `.env`

## 💳 Métodos de Pago

### Stripe
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### MercadoPago
```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
```

## 📊 Base de Datos

El proyecto usa PostgreSQL con Prisma ORM. Para ver la base de datos:

```bash
npx prisma studio
```

## 🧪 Testing

```bash
# Frontend
cd frontend
npm run test

# Backend
cd backend
npm run test
```

## 📝 Licencia

Todos los derechos reservados © 2026

## 👥 Soporte

Para soporte, contactar a: soporte@consultaperu.com
