import { Component, Input } from '@angular/core';
import { HttpParams } from "@angular/common/http";
import { DataService } from "../data.service";

@Component({
  selector: 'app-search-files',
  template: `
    <mat-form-field class="example-full-width">
      <mat-label>Search text</mat-label>
      <textarea matInput placeholder="Search text" [(ngModel)]="searchQuery"></textarea>
    </mat-form-field>
    <button mat-raised-button (click)="searchFiles()" style="margin-left: 1%">Search</button>
    <div class="spinner-container">
        <mat-spinner *ngIf="isLoading"></mat-spinner>
    </div>
    <app-folder-tree title="Searched files" *ngIf="files" [paths]="files" [rootPath]="rootPath" [index]=2></app-folder-tree>
  `,
  styles: [`
    .example-full-width {
      width: 100%;
    }
    .spinner-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%; /* or a specific height if needed */
    }
  `]
})
export class SearchFilesComponent {
  searchQuery: string = "";
  files: any;
  isLoading: boolean = false;
  @Input() rootPath: string = "";
  @Input() isRecursive: boolean = false;
  @Input() filesExts: string[] = [];

  constructor(private dataService: DataService) {
  }

  searchFiles(): void {
    this.files = null;
    this.isLoading = true;
    let params = new HttpParams();
    params = params.set("root_path", this.rootPath)
    params = params.set("recursive", this.isRecursive)
    params = params.set("required_exts", this.filesExts.join(';'))
    params = params.set("search_query", this.searchQuery)
    this.dataService
      .getSearchFiles(params)
      .subscribe((data: any) => {
        if (!this.rootPath.endsWith('/')) this.rootPath += '/';
        this.files = data.map((item: any) => this.rootPath + item.file);
        this.isLoading = false;
      })
  }
}
