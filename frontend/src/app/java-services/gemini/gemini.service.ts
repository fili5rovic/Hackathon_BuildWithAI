import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  constructor(private http: HttpClient) {}

  baseUrl: string = 'http://localhost:8080/gemini/';

  askPrompt(text: String) {
    return this.http.get<any>(this.baseUrl + 'ask?prompt=' + text);
  }
}
