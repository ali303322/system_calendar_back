const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()


module.exports = async function (fastify, opts) {

  // POST /event-participants - Add participant
  fastify.post('/', async (request, reply) => {
    try {
      const { event_id, user_id, status } = request.body;

      // Prevent duplicate
      const exists = await prisma.eventParticipant.findFirst({
        where: { event_id, user_id },
      });

      if (exists) {
        return reply.code(400).send({ error: 'Participant already exists.' });
      }

      const participant = await prisma.eventParticipant.create({
        data: {
          event_id,
          user_id,
          status,
        },
      });

      reply.code(201).send(participant);
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // DELETE /event-participants/:id - Remove participant
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      await prisma.eventParticipant.delete({
        where: { id },
      });

      reply.send({ message: 'Participant removed' });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET /event-participants/:event_id - List participants by event
  fastify.get('/:event_id', async (request, reply) => {
    try {
      const { event_id } = request.params;

      const participants = await prisma.eventParticipant.findMany({
        where: { event_id },
        include: {
          user: true,
        },
      });

      reply.send(participants);
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // PATCH /event-participants/:id - Update status
  fastify.patch('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      const updated = await prisma.eventParticipant.update({
        where: { id },
        data: { status },
      });

      reply.send(updated);
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
};