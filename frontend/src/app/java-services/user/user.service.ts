import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";


@Injectable({
    providedIn: 'root'
  })
export class UserService {
  
    constructor(private http: HttpClient) { }
  
    baseUrl: string = 'http://localhost:8080/users/';
  
    findAllUsers() {
      return this.http.get<any>(this.baseUrl + "findAll");
    }
  
    findUserById(userId: number) {
      let params = "?id=" + userId;
      return this.http.get<any>(this.baseUrl + 'findById' + params);
    }
  
}