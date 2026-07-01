import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllPlans() {
  try {
    console.log('⏳ Deleting all assignment plans...');

    // Get count before deletion
    const countBefore = await prisma.assignmentPlan.count();
    console.log(`📊 Found ${countBefore} plans to delete`);

    // Delete all assignment plans
    const deleted = await prisma.assignmentPlan.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} assignment plans`);

    // Verify deletion
    const countAfter = await prisma.assignmentPlan.count();
    console.log(`✔️ Remaining plans: ${countAfter}`);
  } catch (error) {
    console.error('❌ Error deleting plans:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllPlans();
