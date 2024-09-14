import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
import { db } from "../db";
import { goalCompletions, goals } from "../db/schema";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";


dayjs.extend(weekOfYear);

export async function getWeekPendingGoals() {
    const firstDayOfweek = dayjs().startOf('week').toDate()
    const lastDayOfweek = dayjs().endOf('week').toDate();

    const goalsCreateUpToWeek = db.$with('goals_created_up_to_week').as(
        db.select({
            id: goals.id,
            title: goals.title,
            desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
            createdAt: goals.createdAt
        })
        .from(goals)
        .where(lte(goals.createdAt, lastDayOfweek))            
    )

    const goalCompletionCounts = db.$with('goal_competion_counts').as(
        db
        .select({
            goalId: goalCompletions.goalId,
            completionCount: count(goalCompletions.id)
            .as('completionCount'),
        })
        .from(goalCompletions)
        .where(and(
            gte(goalCompletions.createdAt, firstDayOfweek),
            lte(goalCompletions.createdAt, lastDayOfweek)
        )) 
        .groupBy(goalCompletions.goalId)
    )

    const pendingGoals = await db
    .with(goalsCreateUpToWeek, goalCompletionCounts)
    .select({
        id: goalsCreateUpToWeek.id,
        title: goalsCreateUpToWeek.title,
        desiredWeeklyFrequency: goalsCreateUpToWeek.desiredWeeklyFrequency,
        completionCount: sql`
        COALESCE(${goalCompletionCounts.completionCount},0)
        `.mapWith(Number),
        
    })
    .from(goalsCreateUpToWeek)
    .leftJoin(goalCompletionCounts, eq(goalCompletionCounts.goalId, goalsCreateUpToWeek.id))

    return {
        pendingGoals
    }
}
