const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = async function (fastify, opts) {
// CREATE Event
fastify.post('/events', async (request, reply) => {
  try {
    const { 
      title, 
      description, 
      start_datetime, 
      end_datetime, 
      location, 
      is_public, 
      created_by, 
      participants = [] 
    } = request.body;

    const event = await prisma.event.create({
      data: {
        title,
        description,
        start_datetime: new Date(start_datetime),
        end_datetime: new Date(end_datetime),
        location,
        is_public,
        created_by,
        participants: {
          connect: participants.map((id) => ({ id })), // array of user IDs
        },
      },
      include: { participants: true }, // include participants in response if needed
    });

    reply.code(201).send(event);
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});


  // READ all Events
  fastify.get('/events', async (request, reply) => {
    try {
      const events = await prisma.event.findMany({
        include: {
          creator: true,
          participants: true,
        },
      });
      reply.send(events);
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // READ one Event by ID
  fastify.get('/events/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          creator: true,
          participants: true,
        },
      });

      if (!event) {
        return reply.code(404).send({ error: 'Event not found' });
      }

      reply.send(event);
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // UPDATE event + manage participants individually
fastify.put('/events/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const {
      title,
      description,
      start_datetime,
      end_datetime,
      location,
      is_public,
      participants = [],
    } = request.body;

    // Step 1: Update event details
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title,
        description,
        start_datetime: new Date(start_datetime),
        end_datetime: new Date(end_datetime),
        location,
        is_public,
      },
    });

    // Step 2: Get current participants from DB
    const existingParticipants = await prisma.eventParticipant.findMany({
      where: { event_id: id },
    });

    const incomingIds = participants.map(p => p.user_id);
    const existingIds = existingParticipants.map(p => p.user_id);

    // Step 3: Participants to delete (in DB but not in new list)
    const toDelete = existingParticipants.filter(p => !incomingIds.includes(p.user_id));

    // Step 4: Participants to add (in new list but not in DB)
    const toAdd = participants.filter(p => !existingIds.includes(p.user_id));

    // Step 5: Participants to update (if status changed)
    const toUpdate = participants.filter(p => {
      const existing = existingParticipants.find(e => e.user_id === p.user_id);
      return existing && existing.status !== p.status;
    });

    // Step 6: Delete removed participants
    await Promise.all(
      toDelete.map(p =>
        prisma.eventParticipant.delete({
          where: { id: p.id },
        })
      )
    );

    // Step 7: Add new participants
    await prisma.eventParticipant.createMany({
      data: toAdd.map(p => ({
        event_id: id,
        user_id: p.user_id,
        status: p.status || 'MAYBE',
      })),
    });

    // Step 8: Update status of existing participants if changed
    await Promise.all(
      toUpdate.map(p =>
        prisma.eventParticipant.updateMany({
          where: {
            event_id: id,
            user_id: p.user_id,
          },
          data: {
            status: p.status,
          },
        })
      )
    );

    reply.send({ message: 'Event updated successfully' });
  } catch (err) {
    console.error(err);
    reply.code(500).send({ error: err.message });
  }
});

  // DELETE Event
  fastify.delete('/events/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      await prisma.event.delete({
        where: { id },
      });

      reply.send({ message: 'Event deleted successfully' });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
};