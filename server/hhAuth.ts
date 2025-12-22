import { db } from "./db";
import { users, resumes } from "@shared/schema";
import { eq } from "drizzle-orm";

const HH_CLIENT_ID = process.env.HH_CLIENT_ID!;
const HH_CLIENT_SECRET = process.env.HH_CLIENT_SECRET!;

export function getRedirectUri(): string {
  return "https://jobswiper.ru/auth/hh/callback";
}

export function getAuthUrl(): string {
  const redirectUri = encodeURIComponent(getRedirectUri());
  return `https://hh.ru/oauth/authorize?response_type=code&client_id=${HH_CLIENT_ID}&redirect_uri=${redirectUri}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const redirectUri = getRedirectUri();
  
  const response = await fetch("https://hh.ru/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: HH_CLIENT_ID,
      client_secret: HH_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("[HH OAuth] Token exchange failed:", error);
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  return response.json();
}

export async function refreshHHToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch("https://hh.ru/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: HH_CLIENT_ID,
      client_secret: HH_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("[HH OAuth] Token refresh failed:", error);
    throw new Error(`Token refresh failed: ${response.status}`);
  }
  
  return response.json();
}

export interface HHUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_anonymous: boolean;
}

export async function getHHUserInfo(accessToken: string): Promise<HHUserInfo> {
  const response = await fetch("https://api.hh.ru/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "JobSwipe/1.0",
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("[HH API] Get user info failed:", error);
    throw new Error(`Get user info failed: ${response.status}`);
  }
  
  return response.json();
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user?.hhAccessToken || !user?.hhRefreshToken) {
    return null;
  }
  
  const now = new Date();
  const expiresAt = user.hhTokenExpiresAt;
  
  if (expiresAt && expiresAt > now) {
    return user.hhAccessToken;
  }
  
  try {
    const tokens = await refreshHHToken(user.hhRefreshToken);
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    await db.update(users)
      .set({
        hhAccessToken: tokens.access_token,
        hhRefreshToken: tokens.refresh_token,
        hhTokenExpiresAt: newExpiresAt,
      })
      .where(eq(users.id, userId));
    
    return tokens.access_token;
  } catch (error) {
    console.error("[HH OAuth] Failed to refresh token:", error);
    return null;
  }
}

export interface HHResumeShort {
  id: string;
  title: string;
  url: string;
  alternate_url: string;
  created_at: string;
  updated_at: string;
}

export interface HHResumeDetail {
  id: string;
  title: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  birth_date: string | null;
  gender: { id: string; name: string } | null;
  area: { id: string; name: string } | null;
  metro: { id: string; name: string } | null;
  salary: { amount: number; currency: string } | null;
  photo: { small: string; medium: string } | null;
  skills: string;
  skill_set: string[];
  total_experience: { months: number } | null;
  experience: Array<{
    company: string;
    position: string;
    start: string;
    end: string | null;
    description: string;
  }>;
  education: {
    primary: Array<{
      name: string;
      organization: string;
      result: string;
      year: number;
    }>;
  };
  language: Array<{
    id: string;
    name: string;
    level: { id: string; name: string };
  }>;
  updated_at: string;
  created_at: string;
}

export async function getHHResumes(accessToken: string): Promise<HHResumeShort[]> {
  const response = await fetch("https://api.hh.ru/resumes/mine", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "JobSwipe/1.0",
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("[HH API] Get resumes failed:", error);
    throw new Error(`Get resumes failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.items || [];
}

export async function getHHResumeDetail(accessToken: string, resumeId: string): Promise<HHResumeDetail> {
  const response = await fetch(`https://api.hh.ru/resumes/${resumeId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "JobSwipe/1.0",
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("[HH API] Get resume detail failed:", error);
    throw new Error(`Get resume detail failed: ${response.status}`);
  }
  
  return response.json();
}

export interface NegotiationResponse {
  id?: string;
  error?: string;
  description?: string;
  errors?: Array<{ type: string; value: string }>;
}

export async function applyToVacancy(
  accessToken: string,
  vacancyId: string,
  resumeId: string,
  message: string
): Promise<NegotiationResponse> {
  const response = await fetch("https://api.hh.ru/negotiations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "JobSwipe/1.0",
    },
    body: new URLSearchParams({
      vacancy_id: vacancyId,
      resume_id: resumeId,
      message,
    }),
  });
  
  const location = response.headers.get("Location");
  
  if (response.status === 201 && location) {
    const negotiationId = location.split("/").pop();
    return { id: negotiationId };
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[HH API] Apply failed:", response.status, errorData);
    return {
      error: errorData.description || errorData.error || `HTTP ${response.status}`,
      errors: errorData.errors,
    };
  }
  
  return {};
}

export function resumeToText(resume: HHResumeDetail): string {
  const parts: string[] = [];
  
  parts.push(`${resume.first_name} ${resume.last_name}`);
  parts.push(`Позиция: ${resume.title}`);
  
  if (resume.area) {
    parts.push(`Локация: ${resume.area.name}`);
  }
  
  if (resume.salary) {
    parts.push(`Желаемая зарплата: ${resume.salary.amount} ${resume.salary.currency}`);
  }
  
  if (resume.total_experience) {
    const years = Math.floor(resume.total_experience.months / 12);
    const months = resume.total_experience.months % 12;
    parts.push(`Опыт работы: ${years} лет ${months} месяцев`);
  }
  
  if (resume.skills) {
    parts.push(`\nНавыки:\n${resume.skills}`);
  }
  
  if (resume.skill_set?.length) {
    parts.push(`Ключевые навыки: ${resume.skill_set.join(", ")}`);
  }
  
  if (resume.experience?.length) {
    parts.push("\nОпыт работы:");
    for (const exp of resume.experience) {
      parts.push(`- ${exp.company}: ${exp.position} (${exp.start} - ${exp.end || "по настоящее время"})`);
      if (exp.description) {
        parts.push(`  ${exp.description.slice(0, 200)}...`);
      }
    }
  }
  
  if (resume.education?.primary?.length) {
    parts.push("\nОбразование:");
    for (const edu of resume.education.primary) {
      parts.push(`- ${edu.name} (${edu.year}): ${edu.result || edu.organization}`);
    }
  }
  
  if (resume.language?.length) {
    parts.push(`\nЯзыки: ${resume.language.map(l => `${l.name} (${l.level.name})`).join(", ")}`);
  }
  
  return parts.join("\n");
}
