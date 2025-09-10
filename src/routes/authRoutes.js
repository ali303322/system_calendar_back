const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const bcrypt = require('bcrypt')

module.exports = async function (fastify, opts) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { fullName, email, password } = request.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.code(400).send({ error: 'Account already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
      },
    })

    const token = fastify.jwt.sign({ sub: user.id, email: user.email })
    return reply.send({ token })
  })

// Login
fastify.post('/login', async (request, reply) => {
  const { email, password } = request.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return reply.code(400).send({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return reply.code(400).send({ error: 'Invalid credentials' });
  }

  const token = fastify.jwt.sign({ sub: user.id, email: user.email });

  // ✅ return user info along with token
  return reply.send({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name, // if you have a name field in DB
    },
  });
});
}
