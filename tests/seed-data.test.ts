import { describe, expect, it } from "vitest";
import actualsJune from "../prisma/actuals-june.json";
import seedData from "../prisma/seed-data.json";

const genericPublishingTitles = new Set(["جدولة ونشر بوستات الشركات"]);

describe("seed data", () => {
  it("does not create broad ad-hoc publishing tasks", () => {
    const juneGeneric = actualsJune.items.filter(
      (item) => item.kind === "ADHOC" && genericPublishingTitles.has(item.title ?? ""),
    );
    const generatedGeneric = seedData.tasks.filter(
      (task) => task.kind === "ADHOC" && genericPublishingTitles.has(task.title ?? ""),
    );

    expect([...juneGeneric, ...generatedGeneric]).toEqual([]);
  });

  it("represents publisher work as one publish card per planned content item", () => {
    const publisherCards = seedData.tasks.filter((task) => task.stage === "PUBLISH");

    expect(publisherCards.length).toBeGreaterThan(0);
    expect(
      publisherCards.every(
        (task) =>
          task.kind === "PUBLISH" &&
          task.companyId != null &&
          task.type != null &&
          task.publishDate != null,
      ),
    ).toBe(true);
  });

  it("does not assign training content writing to Nawal", () => {
    const trainingWriteCards = seedData.tasks.filter(
      (task) => task.companyId === "c_training" && task.stage === "WRITE",
    );
    const trainingDesignCards = seedData.tasks.filter(
      (task) => task.companyId === "c_training" && task.stage === "DESIGN",
    );

    expect(trainingWriteCards).toEqual([]);
    expect(trainingDesignCards.length).toBeGreaterThan(0);
    expect(trainingDesignCards.every((task) => task.blockedById == null)).toBe(true);
  });
});
