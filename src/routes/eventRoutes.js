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
      create: participants.map((userId) => ({
        user: { connect: { id: userId } },
      })),
    },
  },
  include: { 
    participants: { 
      include: { user: true }  // include user details in response
    } 
  },
});


    reply.code(201).send(event);
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});


  // READ all Events + counts
fastify.get('/events', async (request, reply) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        creator: true,
        participants:  {
          include: {
            user: true, 
          },
      },
    }});

    // Current date helpers
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Count all events
    const totalEvents = await prisma.event.count();

    // Count events in current month
    const monthEvents = await prisma.event.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // Count events today
    const todayEvents = await prisma.event.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    reply.send({
      events,
      counts: {
        total: totalEvents,
        thisMonth: monthEvents,
        today: todayEvents,
      },
    });
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});




// READ all Events related to current user + counts
fastify.get('/events/user/:userId', async (request, reply) => {
  try {
    // get userId from JWT/session (assuming you attach it in request.user)
    const userId = request.params.userId;
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    // Find events where user is creator OR participant
    const events = await prisma.event.findMany({
      where: {
        OR: [
          {created_by: userId },
          { participants: { some: { user_id: userId } } }
        ]
      },
      include: {
        creator: true,
        participants: {
          include: { user: true },
        },
      },
    });

    // Current date helpers
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Count all events related to this user
    const totalEvents = await prisma.event.count({
      where: {
        OR: [
          { created_by: userId },
          { participants: { some: { user_id: userId } } }
        ]
      }
    });

    // Count events this month
    const monthEvents = await prisma.event.count({
      where: {
        OR: [
          { created_by: userId },
          { participants: { some: { user_id: userId } } }
        ],
        createdAt: { gte: startOfMonth }
      }
    });

    // Count events today
    const todayEvents = await prisma.event.count({
      where: {
        OR: [
          { created_by: userId },
          { participants: { some: { user_id: userId } } }
        ],
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        }
      }
    });

    reply.send({
      events,
      counts: {
        total: totalEvents,
        thisMonth: monthEvents,
        today: todayEvents,
      },
    });
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
    await prisma.event.update({
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
    const existingIds = existingParticipants.map(p => p.user_id);
    const incomingIds = participants.map(p => p);

    // Step 3: Participants to delete (in DB but not in new list)
    const toDelete = existingParticipants.filter(p => !incomingIds.includes(p.user_id));

    // Step 4: Participants to add (in new list but not in DB)
    const toAdd = participants.filter(p => !existingIds.includes(p));

    // Step 5: Participants to update (status changed)
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
    if (toAdd.length > 0) {
      await prisma.eventParticipant.createMany({
        data: toAdd.map(p => ({
          event_id: id,
          user_id: p,
          status: p.status || 'MAYBE',
        })),
      });
    }

    // Step 8: Update status of existing participants if changed
    await Promise.all(
      toUpdate.map(p =>
        prisma.eventParticipant.updateMany({
          where: {
            event_id: id,
            user_id: p.user_id,
          },
          data: { status: p.status },
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
        where: { id : id },
      });

      reply.send({ message: 'Event deleted successfully' });
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
};