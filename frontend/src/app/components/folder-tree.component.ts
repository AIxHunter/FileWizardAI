import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { Observable, of as observableOf } from 'rxjs';
import { FlatTreeControl } from '@angular/cdk/tree';
import { DataService } from '../data.service';

/** File node data with nested structure. */
export interface FileNode {
  name: string;
  type: string;
  children?: FileNode[];
  path: string;
  highlighted: boolean
}

/** Flat node with expandable and level information */
export interface TreeNode {
  name: string;
  type: string;
  level: number;
  expandable: boolean;
  path: string;
  highlighted: boolean
}

@Component({
  selector: 'app-folder-tree',
  template: `
    <h2>{{headline}}</h2>
    <mat-tree [dataSource]="dataSource" [treeControl]="treeControl" class="custom-tree">
      <h1>text</h1>
      <mat-tree-node *matTreeNodeDef="let node" matTreeNodeToggle matTreeNodePadding [ngStyle]="{ color: node.highlighted ? 'red' : 'inherit' }">
        <button mat-icon-button disabled></button>
        <mat-icon class="type-icon" (click)="onFileOpenClick(node)" [attr.aria-label]="node.type + 'icon'">
          {{ node.type === 'file' ? 'description' : 'folder' }}
        </mat-icon>
        {{node.name}}
        <mat-icon *ngIf="index < 2" matTooltip="Show file in the other Tree" (click)="notifyParent(node)" style="margin-left: 0.5%;">{{ index === 0 ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
      </mat-tree-node>

      <mat-tree-node *matTreeNodeDef="let node;when: hasChild" matTreeNodePadding>
        <button mat-icon-button matTreeNodeToggle
                [attr.aria-label]="'toggle ' + node.name">
          <mat-icon class="mat-icon-rtl-mirror">
            {{treeControl.isExpanded(node) ? 'expand_more' : 'chevron_right'}}
          </mat-icon>
        </button>
        <mat-icon class="type-icon" [attr.aria-label]="node.type + 'icon'">
          {{ node.type === 'file' ? 'description' : 'folder' }}
        </mat-icon>
        {{node.name}}
      </mat-tree-node>
    </mat-tree>

  `,
  styles: [`
    .type-icon {
      color: #999;
      margin-right: 5px;
    }

    ::ng-deep .mat-mdc-icon-button.mat-mdc-button-base {
      width: 48px;
      height: 24px;
      padding: 0;
    }

    ::ng-deep .mat-tree-node {
      min-height: 24px;
    }

    .mat-tree-node:hover {
      background-color: #e0e0e0; /* Light grey on hover */
    }

    .custom-tree {
      margin: 1%;
      border: 2px solid #9E9E9E; /* Green border */
      box-shadow: 0 4px 8px 0 rgba(128, 128, 128, 0.2), 0 6px 20px 0 rgba(128, 128, 128, 0.19); /* Shadow effect in grey */
      padding: 16px; /* Optional padding */
      border-radius: 8px; /* Optional rounded corners */
      background-color: #f5f5f5;
    }

  `]
})

export class FolderTreeComponent implements OnInit {

  /** The TreeControl controls the expand/collapse state of tree nodes.  */
  treeControl: FlatTreeControl<TreeNode>;

  /** The TreeFlattener is used to generate the flat list of items from hierarchical data. */
  treeFlattener: MatTreeFlattener<FileNode, TreeNode>;

  /** The MatTreeFlatDataSource connects the control and flattener to provide data. */
  dataSource: MatTreeFlatDataSource<FileNode, TreeNode>;

  @Input() paths: string[] = [];
  @Input() headline: string = "";
  @Input() rootPath: string = "";
  @Input() index: number = 0;
  @Output() notify = new EventEmitter<any>();

  sep = "/";
  isWin = navigator.userAgent.toLowerCase().includes('win')

  constructor(private dataService: DataService) {
    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren
    );
    this.treeControl = new FlatTreeControl<TreeNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
  }

  ngOnInit(): void {
    this.dataSource.data = this.transformPathsToTree(this.paths)
    this.expandRootNodes();
  }

  expandRootNodes(): void {
    const levels = this.rootPath.split(this.sep).filter(part => part !== '').length;
    for (let i = 0; i < levels; i++) {
      const currentNodes = this.treeControl.dataNodes.filter(node => node.level === i);
      currentNodes.forEach(node => this.treeControl.expand(node));
    }
  }

  transformPathsToTree(paths: string[]): FileNode[] {
    const root: FileNode = { name: '', type: 'Folder', children: [], path: "", highlighted: false };

    paths.forEach(path => {
      const parts = path.split(this.sep);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if(part === '') continue;
        const isFile = i === parts.length - 1;
        const type = isFile ? 'file' : 'Folder';
        let node = current.children?.find(child => child.name === part && child.type === type);
        if (!node) {
          const new_path = current.path === "" && this.isWin ? parts[i] : current.path + "/" + parts[i]
          node = isFile ? { name: part, type: type, path: new_path, highlighted: current.highlighted } : { name: part, type: type, children: [], path: new_path, highlighted: current.highlighted };
          current.children?.push(node);
        }

        if (!isFile) {
          current = node;
        }
      }
    });
    return root.children!
  }

  /** Transform the data to something the tree can read. */
  transformer(node: FileNode, level: number) {
    return {
      name: node.name,
      type: node.type,
      level: level,
      expandable: !!node.children,
      path: node.path,
      highlighted: false
    };
  }

  /** Get the level of the node */
  getLevel(node: TreeNode) {
    return node.level;
  }

  /** Return whether the node is expanded or not. */
  isExpandable(node: TreeNode) {
    return node.expandable;
  };

  /** Get the children for the node. */
  getChildren(node: FileNode): Observable<FileNode[]> {
    return observableOf(node.children ?? []);
  }

  /** Get whether the node has children or not. */
  hasChild(index: number, node: TreeNode) {
    return node.expandable;
  }

  onFileOpenClick(node: TreeNode): void {
    const fullPath = node.path;
    this.dataService.openFile(fullPath).subscribe((data) => { console.log(data) });
  }

  expandNodeByPath(path: string): void {
    const parts = path.split(this.sep).filter(part => part !== '')
    let prefixPath = ""
    parts.forEach(part => {
      prefixPath = prefixPath === "" && this.isWin ? part : prefixPath + this.sep + part
      const node = this.findNodeByPath(prefixPath);
      if (node) {
        this.treeControl.expand(node);
        node.highlighted = true; // Add this line to highlight the node
      }
    })
  }

  findNodeByPath(path: string): TreeNode | null {
    const nodes = this.treeControl.dataNodes;
    let searchedNode = null
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].path === path) {
        searchedNode = nodes[i];
      } else {
        nodes[i].highlighted = false;
      }
    }
    return searchedNode;
  }

  highlightFile(path: string): void {
    this.expandNodeByPath(path);
  }

  notifyParent(node: any): void {
    const nodes = this.treeControl.dataNodes;
    for (let i = 0; i < nodes.length; i++) nodes[i].highlighted = false;
    this.notify.emit({ 'index': this.index, 'path': node.path });
  }
}
