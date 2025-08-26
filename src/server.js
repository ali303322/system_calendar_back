const fastify = require('fastify')({ logger: true })
const authRoutes = require('./routes/authRoutes')
const eventRoutes = require('./routes/eventRoutes')
const usersRoutes = require('./routes/usersRoutes')
const eventParticipantRoutes = require('./routes/eventParticipants')

// Register JWT before routes
fastify.register(require('@fastify/jwt'), {
  secret: 'your-secret-key' // Change this to a secure secret in production
})

// backend Fastify
// fastify.register(require('@fastify/cors'), {
//   origin: 'http://localhost:8081', // l'URL de ton front web
//   credentials: true,
// });


fastify.register(require('@fastify/cors'), { origin: '*' });


// // Register Swagger core (can be early)
// fastify.register(require('@fastify/swagger'), {
//   swagger: {
//     info: {
//       title: 'Fastify + Prisma API',
//       description: 'API documentation for blog post endpoints',
//       version: '1.0.0',
//     },
//     consumes: ['application/json'],
//     produces: ['application/json'],
//   },
// })

fastify.register(authRoutes, {
   prefix: '/auth'
})
fastify.register(eventRoutes);
fastify.register(usersRoutes);

fastify.register(eventParticipantRoutes, {
   prefix: '/event-participants'
})

// // ✅ After routes, register Swagger UI
// fastify.register(require('@fastify/swagger-ui'), {
//   routePrefix: '/', // or '/docs'
//   exposeRoute: true
// })

// // ✅ Generate Swagger spec before server starts
// fastify.ready(err => {
//   if (err) throw err
//   fastify.swagger() // ⬅️ Needed to build the spec
// })

fastify.listen({ port: 8000, host: '0.0.0.0' }, err => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  fastify.log.info(`Server listening on port 8000`)
})
