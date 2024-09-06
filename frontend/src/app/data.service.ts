import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class DataService {

  private apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {
  }

  getFormattedFiles(params: any): Observable<any> {
    return this.http.get<any>(this.apiUrl + "/get_files", { params: params });
  }

  updateStructure(newStructureBody: any): Observable<any> {
    return this.http.post<any>(this.apiUrl + "/update_files", newStructureBody);
  }

  getSearchFiles(params: HttpParams) {
    return this.http.get(this.apiUrl + "/search_files", { params: params });
  }

  openFile(fileToOpen: any): Observable<any> {
    return this.http.post<any>(this.apiUrl + "/open_file", { file_path: fileToOpen });
  }
}
