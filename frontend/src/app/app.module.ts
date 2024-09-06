import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FolderTreeComponent } from './components/folder-tree.component';
import { SearchFilesComponent } from './components/search-files.component';
import { MatTreeModule } from "@angular/material/tree";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { HttpClientModule } from "@angular/common/http";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatCardModule } from "@angular/material/card";
import { MatInputModule } from "@angular/material/input";
import { MatToolbarModule } from "@angular/material/toolbar";
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

@NgModule({
  declarations: [
    AppComponent,
    FolderTreeComponent,
    SearchFilesComponent
  ],
  imports: [BrowserModule, BrowserAnimationsModule, MatTreeModule, MatIconModule, MatButtonModule, HttpClientModule,
    MatCheckboxModule, FormsModule, MatSelectModule, ReactiveFormsModule, MatFormFieldModule,
    MatSelectModule, FormsModule, ReactiveFormsModule, MatCardModule, MatInputModule, MatToolbarModule, MatProgressSpinnerModule, MatTooltipModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
