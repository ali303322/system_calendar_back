const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()   

module.exports = async function (fastify, opts) {
// GET /user/:id - user informations
  fastify.get('/user/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      reply.send(user);
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });


// GET /user/search?email=ali
fastify.get('/user/search', async (request, reply) => {
  try {
    const { email } = request.query;

    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: email, // search partial match
          mode: 'insensitive' // ignore case
        }
      },
      take: 5 // limit suggestions
    });

    reply.send(users);
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});



};