import { PrismaClient } from "@prisma/client";
import { ALL_SKILLS } from "../src/server/skills/catalog";

const prisma = new PrismaClient();

async function main() {
  for (const [i, s] of ALL_SKILLS.entries()) {
    const data = {
      name: s.name,
      category: s.category,
      description: s.description,
      rubric: { dimensions: s.framework.subskills, ...s.framework },
      sortOrder: i,
    };
    await prisma.skill.upsert({
      where: { slug: s.slug },
      update: data,
      create: { slug: s.slug, ...data },
    });
  }
  console.log(`Seeded ${ALL_SKILLS.length} skills.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
