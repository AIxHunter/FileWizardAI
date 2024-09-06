import { Component, HostBinding, Input, QueryList, ViewChildren } from '@angular/core';
import { DataService } from './data.service';
import { HttpParams } from "@angular/common/http";
import { FolderTreeComponent } from './components/folder-tree.component';

@Component({
  selector: 'app-root',
  template: `
      <mat-card class="example-card" appearance="raised">
          <mat-card-content>
              <mat-card-header>
                  <mat-card-title>Update structure</mat-card-title>
              </mat-card-header>
              <mat-form-field style="margin-right: 1%; width: 33%;" appearance="fill">
                  <mat-label>Root path</mat-label>
                  <input matInput placeholder="Path" [(ngModel)]="rootPath" (ngModelChange)="onPathChange($event)">
              </mat-form-field>

              <mat-form-field appearance="fill">
                  <mat-label>Extensions</mat-label>
                  <mat-select [(value)]="filesExts" multiple>
                      <mat-option *ngFor="let fileExt of filesExtsList" [value]="fileExt">
                          {{fileExt}}
                      </mat-option>
                  </mat-select>
              </mat-form-field>

              <mat-checkbox class="example-margin" [(ngModel)]="isRecursive">Recursive</mat-checkbox>

              <br>
              <button mat-raised-button (click)="getFiles()" style="margin-left: 1%">Get Files</button>


          </mat-card-content>
      </mat-card>

      <mat-card *ngIf="isLoading || srcPaths" class="example-card" appearance="raised">
          <mat-card-content>
              <div class="spinner-container">
                  <mat-spinner *ngIf="isLoading"></mat-spinner>
              </div>
              <app-folder-tree headline="Source files" *ngIf="srcPaths" [paths]="srcPaths" [rootPath]="rootPath" [index]=0 (notify)="onNotify($event)"></app-folder-tree>
              <app-folder-tree headline="Wanted files" *ngIf="dstPaths" [paths]="dstPaths" [rootPath]="rootPath" [index]=1 (notify)="onNotify($event)"></app-folder-tree>

              <button *ngIf="original_files" mat-raised-button (click)="updateStructure()">updateStructure</button>
              <div style="margin-top: 1%">
                  <span *ngIf="successMessage" style="color: green">{{ successMessage }}</span>
                  <span *ngIf="errorMessage" style="color: red">{{ errorMessage }}</span>
              </div>
          </mat-card-content>
      </mat-card>

      <mat-card class="example-card" appearance="raised">
          <mat-card-header>
              <mat-card-title>Search files</mat-card-title>
          </mat-card-header>
          <mat-card-content>
              <app-search-files [rootPath]="rootPath" [isRecursive]="isRecursive" [filesExts]="filesExts"></app-search-files>
          </mat-card-content>
      </mat-card>
  `,
  styles: [`
    .example-card {
      margin: 1%;
    }
    .spinner-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%; /* or a specific height if needed */
  }`]
})
export class AppComponent {

  @ViewChildren(FolderTreeComponent) childComponents!: QueryList<FolderTreeComponent>;

  original_files: any;
  srcPaths: any;
  dstPaths: any;
  rootPath: string = "";
  isRecursive: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  filesExts: string[] = ['.pdf', '.txt', '.png', '.jpg', '.jpeg'];
  filesExtsList: string[] = ['.pdf', '.txt', '.png', '.jpg', '.jpeg'];
  @HostBinding('class.active')
  @Input()
  selectedOptions: string[] = [];

  constructor(private dataService: DataService) {
  }

  onPathChange(value: string) {
    this.rootPath = value.replaceAll("\\\\", "/").replaceAll("\\", "/")
  }

  getFiles(): void {
    this.srcPaths = null;
    this.dstPaths = null;
    this.isLoading = true;
    let params = new HttpParams();
    params = params.set("root_path", this.rootPath)
    params = params.set("recursive", this.isRecursive)
    params = params.set("required_exts", this.filesExts.join(';'))
    this.dataService.getFormattedFiles(params).subscribe((data) => {
      this.original_files = data
      this.original_files.items = this.original_files.items.map((item: any) => ({src_path: item.src_path.replaceAll("\\\\", "/").replaceAll("\\", "/"), dst_path: item.dst_path}))
      let res = this.original_files.items.map((item: any) => ({ src_path: `${data.root_path}/${item.src_path}`, dst_path: `${data.root_path}/${item.dst_path}` }))
      this.srcPaths = res.map((r: any) => r.src_path);
      this.dstPaths = res.map((r: any) => r.dst_path);
      this.isLoading = false;
    })
  }

  updateStructure(): void {
    this.dataService.updateStructure(this.original_files).subscribe(data => {
      this.successMessage = 'Files re-structured successfully.';
    },
      (error) => {
        console.error(error);
        this.errorMessage = 'An error occurred while moving data.';
      });
  }

  onNotify(value: any): void {
    const index = 1 - value.index; // call the other tree: 0 -> 1, 1 -> 0
    const path = value.path; // get dst ot src path
    const root_path = this.original_files.root_path;
    let matchingFilePath = "";
    if (value.index === 0)
      matchingFilePath = root_path + "/" + this.original_files.items.find((file: any) => root_path + "/" + file.src_path === path)?.dst_path;
    else
      matchingFilePath = root_path + "/" + this.original_files.items.find((file: any) => root_path + "/" + file.dst_path === path)?.src_path;
    this.childComponents.toArray()[index].highlightFile(matchingFilePath);
  }

}
