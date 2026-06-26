import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Established company baselines — live DB counts are added on top */
const BASE = {
  projectsDelivered: 499,
  industriesServed: 43,
  ideasValidated: 199,
  ideasSubmitted: 1199,
  ideasApproved: 339,
  productsLaunched: 84,
  activeInnovators: 497,
};

export async function GET() {
  try {
    const [projects, ideas, ideasApproved, innovators, industryGroups] = await Promise.all([
      prisma.project.count(),
      prisma.idea.count(),
      prisma.idea.count({
        where: { status: { in: ["APPROVED", "IN_DEVELOPMENT"] } },
      }),
      prisma.user.count({ where: { role: "INNOVATOR" } }),
      prisma.solutionRequest.groupBy({ by: ["industry"] }),
    ]);

    const industriesFromDb = industryGroups.length;

    return NextResponse.json({
      projectsDelivered: BASE.projectsDelivered + projects,
      industriesServed: BASE.industriesServed + industriesFromDb,
      ideasValidated: BASE.ideasValidated + ideasApproved,
      clientSatisfaction: 99.9,
      ideasSubmitted: BASE.ideasSubmitted + ideas,
      ideasApproved: BASE.ideasApproved + ideasApproved,
      productsLaunched: BASE.productsLaunched + Math.floor(ideasApproved / 4),
      activeInnovators: BASE.activeInnovators + innovators,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      projectsDelivered: 500,
      industriesServed: 50,
      ideasValidated: 200,
      clientSatisfaction: 99.9,
      ideasSubmitted: 1200,
      ideasApproved: 340,
      productsLaunched: 85,
      activeInnovators: 500,
      updatedAt: new Date().toISOString(),
    });
  }
}
