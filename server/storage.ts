import { 
  type User, type InsertUser, 
  type Job, type InsertJob, 
  type Swipe, type InsertSwipe,
  type Resume, type InsertResume,
  type Application, type InsertApplication,
  type AiCompatibility, type InsertAiCompatibility,
  jobs, swipes, users, resumes, applications, aiCompatibility 
} from "@shared/schema";
import { db } from "./db";
import { eq, notInArray, inArray, desc, ilike, or, and, gte, lte, sql, isNull } from "drizzle-orm";

export interface JobFilters {
  company?: string;
  salaryRange?: string;
  employmentType?: string;
  location?: string;
  keyword?: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllJobs(): Promise<Job[]>;
  getUnswipedJobs(filters?: JobFilters): Promise<Job[]>;
  getFilterOptions(): Promise<{ companies: string[]; locations: string[] }>;
  searchJobs(filters: { company?: string; minSalary?: number; maxSalary?: number; keyword?: string; title?: string }): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  seedJobs(jobList: InsertJob[]): Promise<void>;
  
  createSwipe(userId: string, vacancyId: string, direction: string): Promise<Swipe>;
  getSwipedVacancyIds(userId: string): Promise<string[]>;
  hasSwipedVacancy(userId: string, vacancyId: string): Promise<boolean>;
  getSwipeHistory(userId: string): Promise<Swipe[]>;
  deleteAllSwipes(userId: string): Promise<void>;
  
  getManualResume(userId: string): Promise<Resume | undefined>;
  saveManualResume(userId: string, content: string): Promise<Resume>;
  
  createApplication(application: InsertApplication): Promise<Application>;
  getApplicationsByUser(userId: string): Promise<Application[]>;
  getAllApplications(): Promise<Application[]>;
  updateApplicationCoverLetter(id: number, coverLetter: string): Promise<Application | undefined>;
  getPendingApplicationsCount(userId: string): Promise<number>;
  
  // AI Compatibility
  saveCompatibility(userId: string, vacancyId: string, data: { score: number; color: string; explanation: string }): Promise<AiCompatibility>;
  getCompatibility(userId: string, vacancyId: string): Promise<AiCompatibility | undefined>;
  getCompatibilitiesByUser(userId: string): Promise<AiCompatibility[]>;
  deleteCompatibility(userId: string, vacancyId: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getUnswipedJobs(filters?: JobFilters): Promise<Job[]> {
    const conditions = [];
    
    if (filters) {
      if (filters.company && filters.company !== 'all') {
        conditions.push(eq(jobs.company, filters.company));
      }
      
      if (filters.employmentType && filters.employmentType !== 'all') {
        conditions.push(eq(jobs.employmentType, filters.employmentType));
      }
      
      if (filters.location && filters.location !== 'all') {
        conditions.push(eq(jobs.location, filters.location));
      }
      
      if (filters.keyword) {
        conditions.push(
          or(
            ilike(jobs.description, `%${filters.keyword}%`),
            ilike(jobs.title, `%${filters.keyword}%`)
          )
        );
      }
      
      if (filters.salaryRange && filters.salaryRange !== 'all') {
        const allJobs = await db.select().from(jobs);
        const matchingJobIds: number[] = [];
        
        for (const job of allJobs) {
          const salary = job.salary;
          const match = salary.match(/(\d+)/);
          if (match) {
            const lowerBound = parseInt(match[1]);
            let matches = false;
            
            switch (filters.salaryRange) {
              case 'under150':
                matches = lowerBound < 150;
                break;
              case '150-200':
                matches = lowerBound >= 150 && lowerBound <= 200;
                break;
              case '200plus':
                matches = lowerBound >= 200;
                break;
            }
            
            if (matches) {
              matchingJobIds.push(job.id);
            }
          }
        }
        
        if (matchingJobIds.length > 0) {
          conditions.push(inArray(jobs.id, matchingJobIds));
        } else {
          conditions.push(eq(jobs.id, -1));
        }
      }
    }
    
    if (conditions.length === 0) {
      return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    }
    
    return await db.select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt));
  }

  async getFilterOptions(): Promise<{ companies: string[]; locations: string[] }> {
    const allJobs = await this.getAllJobs();
    const companiesSet = new Set<string>();
    const locationsSet = new Set<string>();
    
    for (const job of allJobs) {
      companiesSet.add(job.company);
      locationsSet.add(job.location);
    }
    
    const companies = Array.from(companiesSet).sort();
    const locations = Array.from(locationsSet).sort();
    return { companies, locations };
  }

  async searchJobs(filters: { company?: string; minSalary?: number; maxSalary?: number; keyword?: string; title?: string }): Promise<Job[]> {
    const conditions = [];
    
    if (filters.company) {
      conditions.push(ilike(jobs.company, `%${filters.company}%`));
    }
    
    if (filters.title) {
      conditions.push(ilike(jobs.title, `%${filters.title}%`));
    }
    
    if (filters.keyword) {
      conditions.push(
        or(
          ilike(jobs.description, `%${filters.keyword}%`),
          ilike(jobs.title, `%${filters.keyword}%`)
        )
      );
    }
    
    if (conditions.length === 0) {
      return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    }
    
    return await db.select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt));
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async seedJobs(jobList: InsertJob[]): Promise<void> {
    const existingJobs = await this.getAllJobs();
    if (existingJobs.length === 0) {
      await db.insert(jobs).values(jobList);
    }
  }

  async createSwipe(userId: string, vacancyId: string, direction: string): Promise<Swipe> {
    const [created] = await db.insert(swipes).values({
      userId,
      vacancyId,
      direction,
    }).returning();
    return created;
  }

  async getSwipedVacancyIds(userId: string): Promise<string[]> {
    const swiped = await db.select({ vacancyId: swipes.vacancyId })
      .from(swipes)
      .where(eq(swipes.userId, userId));
    return swiped.map(s => s.vacancyId);
  }

  async hasSwipedVacancy(userId: string, vacancyId: string): Promise<boolean> {
    const [existing] = await db.select({ id: swipes.id })
      .from(swipes)
      .where(and(
        eq(swipes.userId, userId),
        eq(swipes.vacancyId, vacancyId)
      ))
      .limit(1);
    return !!existing;
  }

  async getSwipeHistory(userId: string): Promise<Swipe[]> {
    return await db.select()
      .from(swipes)
      .where(eq(swipes.userId, userId))
      .orderBy(desc(swipes.createdAt));
  }

  async deleteAllSwipes(userId: string): Promise<void> {
    await db.delete(swipes).where(eq(swipes.userId, userId));
  }

  async getManualResume(userId: string): Promise<Resume | undefined> {
    const [resume] = await db.select()
      .from(resumes)
      .where(and(
        eq(resumes.userId, userId),
        sql`${resumes.hhResumeId} IS NULL`
      ))
      .orderBy(desc(resumes.updatedAt))
      .limit(1);
    return resume;
  }

  async saveManualResume(userId: string, content: string): Promise<Resume> {
    const existing = await this.getManualResume(userId);
    
    if (existing) {
      const [updated] = await db
        .update(resumes)
        .set({ content, updatedAt: new Date() })
        .where(eq(resumes.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(resumes).values({ 
      userId,
      content,
      hhResumeId: null,
      selected: false,
    }).returning();
    return created;
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const [created] = await db.insert(applications).values(application).returning();
    return created;
  }

  async getApplicationsByUser(userId: string): Promise<Application[]> {
    return await db.select()
      .from(applications)
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.appliedAt));
  }

  async getAllApplications(): Promise<Application[]> {
    return await db.select().from(applications).orderBy(desc(applications.appliedAt));
  }

  async updateApplicationCoverLetter(id: number, coverLetter: string): Promise<Application | undefined> {
    const [updated] = await db
      .update(applications)
      .set({ coverLetter })
      .where(eq(applications.id, id))
      .returning();
    return updated;
  }

  async getPendingApplicationsCount(userId: string): Promise<number> {
    const result = await db.select()
      .from(applications)
      .where(and(
        eq(applications.userId, userId),
        isNull(applications.coverLetter),
        or(
          eq(applications.status, "pending"),
          eq(applications.status, "queued")
        )
      ));
    return result.length;
  }

  // AI Compatibility methods
  async saveCompatibility(userId: string, vacancyId: string, data: { score: number; color: string; explanation: string }): Promise<AiCompatibility> {
    // Upsert: delete existing and insert new
    await db.delete(aiCompatibility)
      .where(and(
        eq(aiCompatibility.userId, userId),
        eq(aiCompatibility.vacancyId, vacancyId)
      ));
    
    const [created] = await db.insert(aiCompatibility).values({
      userId,
      vacancyId,
      score: data.score,
      color: data.color,
      explanation: data.explanation,
    }).returning();
    return created;
  }

  async getCompatibility(userId: string, vacancyId: string): Promise<AiCompatibility | undefined> {
    const [result] = await db.select()
      .from(aiCompatibility)
      .where(and(
        eq(aiCompatibility.userId, userId),
        eq(aiCompatibility.vacancyId, vacancyId)
      ))
      .limit(1);
    return result;
  }

  async getCompatibilitiesByUser(userId: string): Promise<AiCompatibility[]> {
    return await db.select()
      .from(aiCompatibility)
      .where(eq(aiCompatibility.userId, userId))
      .orderBy(desc(aiCompatibility.createdAt));
  }

  async deleteCompatibility(userId: string, vacancyId: string): Promise<void> {
    await db.delete(aiCompatibility)
      .where(and(
        eq(aiCompatibility.userId, userId),
        eq(aiCompatibility.vacancyId, vacancyId)
      ));
  }
}

export const storage = new DbStorage();
