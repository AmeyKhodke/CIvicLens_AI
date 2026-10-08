/* API client utility for the frontend. */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: body instanceof FormData
        ? { Authorization: `Bearer ${this.getToken() || ''}` }
        : this.getHeaders(headers),
    };

    if (body) {
      fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (netErr: any) {
      const errorObj: any = new Error(
        `Unable to connect to backend at ${this.baseUrl}. Please ensure the backend server (FastAPI) is running.`
      );
      errorObj.status = 0;
      errorObj.isNetworkError = true;
      throw errorObj;
    }

    if (!response.ok) {
      if (response.status === 401 && endpoint !== '/auth/login') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.dispatchEvent(new Event('auth-change'));
        }
      }
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      const errorObj: any = new Error(error.detail || `HTTP ${response.status}`);
      errorObj.status = response.status;
      throw errorObj;
    }

    // Handle blob responses for file downloads
    const contentType = response.headers.get('content-type');
    if (contentType && (contentType.includes('pdf') || contentType.includes('octet') || contentType.includes('word'))) {
      return response.blob() as any;
    }

    return response.json();
  }

  // ── Auth & Users ──
  async login(username: string, password: string) {
    return this.request<{access_token: string; user: any}>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  }

  async register(data: { username: string; email: string; password: string; full_name: string; designation?: string; department?: string; role?: string; contact?: string }) {
    return this.request<any>('/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async forgotPassword(username_or_email: string) {
    return this.request<{ success: boolean; message: string; demo_reset_code?: string; username?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { username_or_email },
    });
  }

  async resetPassword(data: { username_or_email: string; reset_code: string; new_password: string }) {
    return this.request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: data,
    });
  }

  async getProfile() {
    return this.request<any>('/auth/me');
  }

  async logout() {
    try {
      await this.request<any>('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth-change'));
      }
    }
  }

  async getSessionInfo() {
    return this.request<any>('/auth/session');
  }

  async getUsers(params?: { role?: string; search?: string }) {
    const cleanParams: Record<string, string> = {};
    if (params?.role && params.role !== 'all') cleanParams.role = params.role;
    if (params?.search) cleanParams.search = params.search;
    const query = new URLSearchParams(cleanParams).toString();
    return this.request<any[]>(`/auth/users${query ? '?' + query : ''}`);
  }

  async createUser(data: any) {
    return this.request<any>('/auth/users', {
      method: 'POST',
      body: data,
    });
  }

  async updateUser(userId: string, data: any) {
    return this.request<any>(`/auth/users/${userId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async adminResetPassword(userId: string, new_password: string) {
    return this.request<any>(`/auth/users/${userId}/reset-password`, {
      method: 'POST',
      body: { new_password },
    });
  }

  async deleteUser(userId: string) {
    return this.request<any>(`/auth/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // ── Meetings ──
  async getMeetings(params?: { status?: string; search?: string }) {
    const cleanParams: Record<string, string> = {};
    if (params?.status && params.status.trim() && params.status !== 'all' && params.status !== 'undefined') {
      cleanParams.status = params.status.trim();
    }
    if (params?.search && params.search.trim()) {
      cleanParams.search = params.search.trim();
    }
    const query = new URLSearchParams(cleanParams).toString();
    return this.request<any[]>(`/meetings/${query ? '?' + query : ''}`);
  }

  async getMeeting(id: string) {
    return this.request<any>(`/meetings/${id}`);
  }

  async createMeeting(data: any) {
    return this.request<any>('/meetings/', { method: 'POST', body: data });
  }

  async updateMeeting(id: string, data: any) {
    return this.request<any>(`/meetings/${id}`, { method: 'PUT', body: data });
  }

  async deleteMeeting(id: string) {
    return this.request<any>(`/meetings/${id}`, { method: 'DELETE' });
  }

  async uploadMeetingAudio(meetingId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<any>(`/meetings/${meetingId}/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  async uploadAudio(meetingId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<any>(`/meetings/${meetingId}/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  async uploadAgenda(meetingId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<any>(`/meetings/${meetingId}/upload-agenda`, {
      method: 'POST',
      body: formData,
    });
  }

  // ── Transcription ──
  async transcribe(meetingId: string) {
    return this.request<any>(`/meetings/${meetingId}/transcribe`, { method: 'POST' });
  }

  async getTranscript(meetingId: string) {
    return this.request<any[]>(`/meetings/${meetingId}/transcript`);
  }

  async mapSpeakers(meetingId: string, mappings: Record<string, string>) {
    return this.request<any>(`/meetings/${meetingId}/speakers`, {
      method: 'PUT',
      body: { mappings },
    });
  }

  // ── Summary ──
  async summarize(meetingId: string, summaryType: string = 'detailed', language: string = 'en') {
    return this.request<any>(`/meetings/${meetingId}/summarize`, {
      method: 'POST',
      body: { summary_type: summaryType, language },
    });
  }

  async getSummaries(meetingId: string) {
    return this.request<any[]>(`/meetings/${meetingId}/summary`);
  }

  async editSummary(meetingId: string, summaryId: string, data: any) {
    return this.request<any>(`/meetings/${meetingId}/summary/${summaryId}`, {
      method: 'PUT',
      body: data,
    });
  }

  // ── Actions ──
  async getActions(meetingId: string) {
    return this.request<any[]>(`/meetings/${meetingId}/actions`);
  }

  async updateAction(actionId: string, data: any) {
    return this.request<any>(`/actions/${actionId}`, { method: 'PUT', body: data });
  }

  async getActionsDashboard() {
    return this.request<any[]>('/actions/dashboard');
  }

  // ── Chat ──
  async chat(meetingId: string, question: string, language: string = 'en') {
    return this.request<{answer: string; sources: any[]}>(`/meetings/${meetingId}/chat`, {
      method: 'POST',
      body: { question, language },
    });
  }

  // ── Documents ──
  async getDocuments() {
    return this.request<any[]>('/api/documents/');
  }

  async getDocument(id: string) {
    return this.request<any>(`/api/documents/${id}`);
  }

  async uploadDocument(file: File, title?: string, language: string = 'en') {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    formData.append('language', language);
    return this.request<any>('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async chatWithDocument(documentId: string, question: string, language: string = 'en') {
    return this.request<any>(`/api/documents/${documentId}/chat`, {
      method: 'POST',
      body: { question, language },
    });
  }

  async deleteDocument(id: string) {
    return this.request<any>(`/api/documents/${id}`, { method: 'DELETE' });
  }

  async globalAssistantChat(question: string, language: string = 'en') {
    return this.request<any>('/api/documents/assistant/chat', {
      method: 'POST',
      body: { question, language },
    });
  }

  // ── RAG Evaluation (RAGAS) ──
  async evaluateDocument(documentId: string, options?: { custom_questions?: any[]; top_k?: number }) {
    return this.request<any>(`/api/documents/${documentId}/evaluate`, {
      method: 'POST',
      body: options || {},
    });
  }

  async getDocumentEvaluation(documentId: string) {
    return this.request<any>(`/api/documents/${documentId}/evaluation`);
  }

  // ── Export ──
  async exportMeeting(meetingId: string, format: string = 'json') {
    return this.request<any>(`/meetings/${meetingId}/export?format=${format}`);
  }
}

export const api = new ApiClient(API_BASE);
export default api;
