import { and, count, eq, gte, lte, sql } from "drizzle-orm"
import { db } from "../db"
import { goalCompletions, goals } from "../db/schema"
import dayjs from "dayjs";


export async function getWeekSummary() {
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

    const goalsCompletedInWeek = db.$with('goal_completed_in_week').as(
        db
        .select({
            id: goalCompletions.id,
            title:goals.title,
            completedAt:goalCompletions.createdAt,
            completedAtDate: sql/*sql*/`
                DATE(${goalCompletions.createdAt})
            `.as('completedAtDate'),
        })
        .from(goalCompletions)
        .innerJoin(goals, eq(goals.id, goalCompletions.goalId))
        .where(and(
            gte(goalCompletions.createdAt, firstDayOfweek),
            lte(goalCompletions.createdAt, lastDayOfweek)
        )) 
    )

    const goalsCompletedByWeekDay = db.$with('goals_completed_by_week_day').as(
        db
        .select({
            completedAtDate: goalsCompletedInWeek.completedAtDate,
            completions: sql/*sql*/`
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', ${goalsCompletedInWeek.id},
                        'title', ${goalsCompletedInWeek.title},
                        'completedAt', ${goalsCompletedInWeek.completedAt}
                    )
                )
            `.as('completions'),
        })
        .from(goalsCompletedInWeek)
        .groupBy(goalsCompletedInWeek.completedAtDate)
    )

    const result = await db
    .with(goalsCreateUpToWeek, goalsCompletedInWeek, goalsCompletedByWeekDay)
    .select({
        completed: sql/*sql*/`
            (SELECT COUNT(*) FROM ${goalsCompletedInWeek})
        `.mapWith(Number),
        total: sql/*sql*/`
            (SELECT SUM(${goalsCreateUpToWeek.desiredWeeklyFrequency}) FROM ${goalsCreateUpToWeek})
        `.mapWith(Number),
        goalsPerDay: sql/*sql*/`
            JSON_OBJECT_AGG(
                ${goalsCompletedByWeekDay.completedAtDate},
                ${goalsCompletedByWeekDay.completions}
            )
        `
    })
    .from(goalsCompletedByWeekDay)

    return {
        summary: result
    }
}
