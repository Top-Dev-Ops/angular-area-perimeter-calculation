import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { switchMap, takeUntil, pairwise } from 'rxjs/operators';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { saveAs } from 'file-saver';
import MagicWand from 'magic-wand-tool';

export const tooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 200,
  hideDelay: 200,
  touchendHideDelay: 200,
};

@Component({
  selector: 'vex-xcope',
  templateUrl: './xcope.component.html',
  styleUrls: ['./xcope.component.scss'],
  providers: [{ provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: tooltipDefaults }],
})

export class XcopeComponent implements AfterViewInit {

  /* html의 element들 */
  @ViewChild('canvas') canvasElement: ElementRef;
  @ViewChild('canvas_background') sceneElement: ElementRef;
  @ViewChild('background') imgElement: ElementRef;

  /* html의 element들로부터 얻어내는 객체변수들 */
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scene: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;
  private rect = null;

  /* html과 련결된 변수들(ng-model like) */
  line_tool_card_display = false;       // line도구의 세부도구card현시상태를 반영
  magic_wand_tool_card_display = false; // magic wand도구의 세부도구card현시상태를 반영
  scale_factor = 5;                     // 지도의 축적상태(default값 1:5)
  selected_unit = 'cm';                 // 지도의 단위(cm, m, in)
  hide_canvas = 'HIDE CANVAS';          // HIDE CANVAS / SHOW CANVAS
  hide_image = 'HIDE IMAGE';            // HIDE IMAGE / SHOW IMAGE

  /* canvas에 대한 mouse사건들 */
  mousedown = null;
  mousemove = null;
  mouseup = null;
  mousewheel = null;
  /* mousemove시 마우스가 눌리워져있는가를 검사하는 변수 */
  isMouseDown = false;
  isDraggable = false;

  /* controller에서 리용하는 변수들 */
  selected_tool = '';                                       // 지금 선택된 도구의 이름. e.g. 'line', 'rectangle'...
  perimeters = [];                                          // polygon의 점들의 배렬
  origin_x = null; origin_y = null;                         // 시작점-마우스를 눌렀을 때의 점위치
  target_x = null; target_y = null;                         // 마감점-마우스를 놓았을 때의 점위치
  zoom_scale = 1;                                           // 배경화상의 확대/축소비률(mouse wheel사건시 변화)
  drag_start;                                               // 배경화상을 pan할 때 마우스클릭점위치
  hLeft = null; hRight = null; vTop = null; vBottom = null; // 원을 그릴 때 원의 수평 및 수직점들
  imageInfo = null;
  mask = null;
  area_length = 1;

  constructor() { }

  /* 모든 변수의 초기화 */
  ngAfterViewInit() {
    this.canvas = this.canvasElement.nativeElement;
    this.scene = this.sceneElement.nativeElement;
    this.canvas.width = window.innerWidth - 280; // 280: left sidebar너비
    this.canvas.height = window.innerHeight;
    this.scene.width = window.innerWidth - 280;
    this.scene.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d');
    this.sceneCtx = this.scene.getContext('2d');
    this.rect = this.canvas.getBoundingClientRect();
  }

  /* 기본도구를 선택할 때 세부도구선택card의 현시 및 비현시, 세부도구선택, 또한 topbar의 settings메뉴 및 세부메뉴선택 */
  openTool(tool: string, event = null) {
    this.selected_tool = tool;
    switch (tool) {
      case 'hide_image':
        this.hide_image = this.hide_image == 'HIDE IMAGE' ? 'SHOW IMAGE' : 'HIDE IMAGE';
        break;
      case 'hide_canvas':
        this.hide_canvas = this.hide_canvas == 'HIDE CANVAS' ? 'SHOW CANVAS' : 'HIDE CANVAS';
        break;
      case 'line_tool':
        this.line_tool_card_display = !this.line_tool_card_display;
        this.magic_wand_tool_card_display = false;
        this.canvas.style.cursor = 'default';
        break;
      case 'magic_wand_tool':
        this.magic_wand_tool_card_display = !this.magic_wand_tool_card_display;
        this.line_tool_card_display = false;
        this.canvas.style.cursor = 'default';
        break;
      case 'settings':
        this.line_tool_card_display = false;
        this.magic_wand_tool_card_display = false;
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        this.canvas.style.cursor = 'default';
        break;
      case 'clear_canvas':
        this.line_tool_card_display = false;
        this.magic_wand_tool_card_display = false;
        this.perimeters = [];
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.canvas.style.cursor = 'default';
        break;
      case 'export':
        console.log(this.perimeters);
        var blob = new Blob([JSON.stringify(this.perimeters)], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, 'perimeters.json');
        this.canvas.style.cursor = 'default';
        break;
      case 'print':
        window.print();
        this.canvas.style.cursor = 'default';
        break;
      case 'import':
        this.readImage(event);
        this.canvas.style.cursor = 'default';
        break;
      case 'hand':
        this.canvas.style.cursor = 'move';
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        this.perimeters = [];
        break;
      default:
        this.line_tool_card_display = false;
        this.magic_wand_tool_card_display = false;
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        this.perimeters = [];
        break;
    }
  }

  /* import메뉴를 눌러 배경화상선택후 화상을 읽어 화면에 현시 */
  readImage(event) {
    // console.log('배경화상화일: ' + event.target.files[0].name);
    if (event.target.files && event.target.files[0]) {
      var reader = new FileReader();
      reader.onload = e => {
        this.sceneCtx.clearRect(0, 0, this.rect.left, this.rect.bottom);
        this.imgElement.nativeElement.src = e.target.result;
        var width = this.imgElement.nativeElement.width;
        var height = this.imgElement.nativeElement.height;
        this.imageInfo = {
          width: this.canvas.width,
          height: this.canvas.height,
          context: this.ctx
        };
        setTimeout(() => {
          this.sceneCtx.drawImage(this.imgElement.nativeElement, (this.rect.right - width - 280) / 2, (this.rect.bottom - height - 70) / 2);
          this.imageInfo.data = this.sceneCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }, 500);
      }
      reader.readAsDataURL(event.target.files[0]);
    }
  }

  /* canvas의 mouse사건함수 subscribe: 사용자가 도구를 선택하였을 때에만 사건이 활성화 */
  private captureEvents(canvasEl: HTMLCanvasElement, _selected_tool: string) {

    /* canvas에 대한 mousedown */
    this.mousedown = fromEvent(canvasEl, 'mousedown').subscribe((res: MouseEvent) => {
      var x = res.clientX - this.rect.left;
      var y = res.clientY - this.rect.top;
      switch (_selected_tool) {
        case 'line':
          if (this.perimeters.length > 0 && this.checkPerimeterPointClicked(x, y, this.perimeters) == 0) {
            if (this.perimeters.length == 2) {
              alert('다각형을 구성하려면 적어도 3개의 점이 필요합니다.');
              return false;
            }
            x = this.perimeters[0].x;
            y = this.perimeters[0].y;
            if (this.checkIntersects(x, y)) {
              alert('오유: 당신이 그리고있는 선이 다른 선과 교차합니다.');
              return false;
            }
            this.draw(true, _selected_tool);
            this.drawLabels(true);
            document.getElementById('area_perimeter_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).perimeter + ' ' + 'cm';
            document.getElementById('area_area_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).area + ' ' + 'cm<sup>2</sup>';
            res.preventDefault();
            this.uncaptureEvents();
            return false;
          }
          if (this.perimeters.length > 0 && x == this.perimeters[this.perimeters.length - 1]['x'] && y == this.perimeters[this.perimeters.length - 1]['y']) {
            return false; // 같은 점을 double click
          }
          if (this.checkIntersects(x, y)) {
            alert('오유: 당신이 그리고있는 선이 다른 선과 교차합니다.');
            return false;
          }
          this.perimeters.push({ x: x, y: y });
          document.getElementById('area_perimeter_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).perimeter + ' ' + 'cm';
          this.draw(false, _selected_tool);
          this.drawLabels();
          break;
        case 'rectangle':
          this.isMouseDown = true;
          this.origin_x = x;
          this.origin_y = y;
          break;
        case 'pen':
          this.isMouseDown = true;
          this.perimeters = [];
          this.perimeters.push({ x: x, y: y });
          break;
        case 'circle':
          this.isMouseDown = true;
          this.origin_x = x;
          this.origin_y = y;
          break;
        case 'hand':
          this.isDraggable = true;
          this.drag_start = { x: res.offsetX || x, y: res.offsetY || y };
          console.log('----------------------');
          console.log(res.offsetX, x);
          console.log(res.offsetY, y);
          console.log(this.drag_start.x, this.drag_start.y);
          break;
        case 'magic_wand':
          this.perimeters = [];
          this.drawMask(x, y);
          console.log('area & peri ', this.calculateAreaPerimeter(this.perimeters).area + " : " + this.calculateAreaPerimeter(this.perimeters).perimeter);
          break;
      }
    });

    /* canvas에 대한 mouseup */
    this.mouseup = fromEvent(canvasEl, 'mouseup').subscribe((res: MouseEvent) => {
      switch (_selected_tool) {
        case 'rectangle':
          this.isMouseDown = false;
          break;
        case 'pen':
          this.isMouseDown = false;
          break;
        case 'circle':
          this.isMouseDown = false;
          break;
        case 'hand':
          this.isDraggable = false;
          this.drag_start = null;
          break;
      }
    });

    /* canvas에 대한 mousemove */
    this.mousemove = fromEvent(canvasEl, 'mousemove').subscribe((res: MouseEvent) => {
      var x = res.clientX - this.rect.left;
      var y = res.clientY - this.rect.top;
      switch (_selected_tool) {
        case 'rectangle':
          if (this.isMouseDown) {
            this.target_x = x;
            this.target_y = y;
            this.perimeters = [];
            this.perimeters.push({ x: this.origin_x, y: this.origin_y });
            this.perimeters.push({ x: this.target_x, y: this.origin_y });
            this.perimeters.push({ x: this.target_x, y: this.target_y });
            this.perimeters.push({ x: this.origin_x, y: this.target_y });
            this.draw(true, _selected_tool);
            this.drawLabels(true);
            document.getElementById('area_perimeter_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).perimeter + ' ' + 'cm';
            document.getElementById('area_area_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).area + ' ' + 'cm<sup>2</sup>';
          }
          break;
        case 'circle':
          if (this.isMouseDown) {
            this.target_x = x;
            this.target_y = y;
            this.draw(true, _selected_tool);
            this.drawLabels(false);
            document.getElementById('area_perimeter_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).perimeter + ' ' + 'cm';
            document.getElementById('area_area_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).area + ' ' + 'cm<sup>2</sup>';
          }
          break;
        case 'pen':
          if (this.isMouseDown) {
            this.perimeters.push({ x: x, y: y });
            if (Math.abs(x - this.perimeters[0].x) <= 3 && Math.abs(y - this.perimeters[0].y) <= 3) {
              this.draw(true, _selected_tool);
              document.getElementById('area_perimeter_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).perimeter + ' ' + 'cm';
              document.getElementById('area_area_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).area + ' ' + 'cm<sup>2</sup>';
            } else {
              this.draw(false, _selected_tool);
              document.getElementById('area_perimeter_' + this.area_length).innerHTML = this.calculateAreaPerimeter(this.perimeters).perimeter + ' ' + 'cm';
            }
          }
          break;
        case 'hand':
          if (this.drag_start) {
            var pt = { x: res.offsetX || x, y: res.offsetY || y };
            this.sceneCtx.translate(pt.x - this.drag_start.x, pt.y - this.drag_start.y);
            console.log('----------------------');
            console.log('pt-dragstart: ', pt.x - this.drag_start.x, pt.y - this.drag_start.y);
            console.log(res.offsetX, x);
            console.log(res.offsetY, y);
            console.log(pt.x, pt.y);
            this.redraw();
          }
          break;
      }
    });

    /* canvas에 대한 mousewheel */
    this.mousewheel = fromEvent(canvasEl, 'mousewheel').subscribe((res: WheelEvent) => {
      var delta = res.deltaY ? res.deltaY / 120 : res.detail ? -res.detail : 0;
      this.uncaptureEvents();
      if (delta) {
        if (delta > 0) {
          this.canvas.style.cursor = 'zoom-out';
          this.zoom_scale = Math.pow(0.9, this.zoom_scale);
        } else {
          this.canvas.style.cursor = 'zoom-in';
          this.zoom_scale = Math.pow(1.1, this.zoom_scale);
        }

        // 확대/축소실현
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var xform = svg.createSVGMatrix();
        var pt = svg.createSVGPoint();
        var p1 = svg.createSVGPoint();
        var p2 = svg.createSVGPoint();
        pt.x = this.rect.right / 2;
        pt.y = this.rect.bottom / 2;
        pt = pt.matrixTransform(xform.inverse());
        p1.x = 0;
        p1.y = 0;
        p1 = p1.matrixTransform(xform.inverse());
        p2.x = this.rect.right;
        p1.y = this.rect.bottom;
        p2 = p2.matrixTransform(xform.inverse());

        this.sceneCtx.translate(pt.x, pt.y);
        this.sceneCtx.scale(this.zoom_scale, this.zoom_scale);
        this.sceneCtx.translate(-pt.x, -pt.y);
        this.sceneCtx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        this.sceneCtx.drawImage(this.imgElement.nativeElement, (this.scene.width - this.imgElement.nativeElement.width) / 2, (this.scene.height - this.imgElement.nativeElement.height) / 2);
      }
    });
  }

  /* canvas의 mouse사건함수 unsubscribe: 사건비활성화 */
  private uncaptureEvents() {
    if (this.mousedown != null) this.mousedown.unsubscribe();
    if (this.mouseup != null) this.mouseup.unsubscribe();
    if (this.mousemove != null) this.mousemove.unsubscribe();
  }

  /* 정점들의 배렬 perimeters[]에 기초하여 다각형그리는 함수 */
  private draw(end: boolean, _selected_tool: string) {
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = 'square';
    this.ctx.strokeStyle = 'red';
    switch (_selected_tool) {
      case 'line':
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.ctx.beginPath();
        for (var i = 0; i < this.perimeters.length; i++) {
          if (i == 0) {
            this.ctx.moveTo(this.perimeters[i].x, this.perimeters[i].y);
          } else {
            this.ctx.lineTo(this.perimeters[i].x, this.perimeters[i].y);
          }
          this.point(this.perimeters[i].x, this.perimeters[i].y);
        }
        if (end) {
          this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
          this.ctx.lineTo(this.perimeters[0].x, this.perimeters[0].y);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          this.ctx.fill();
          this.ctx.strokeStyle = 'blue';
          for (i = 0; i < this.perimeters.length; i++) {
            this.point(this.perimeters[i].x, this.perimeters[i].y);
          }
        }
        this.ctx.stroke();
        break;
      case 'rectangle':
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'blue';
        this.ctx.moveTo(this.perimeters[0].x, this.perimeters[0].y);
        for (var i = 1; i < this.perimeters.length; i++) {
          this.ctx.lineTo(this.perimeters[i].x, this.perimeters[i].y);
          this.point(this.perimeters[i].x, this.perimeters[i].y);
        }
        this.ctx.lineTo(this.perimeters[0].x, this.perimeters[0].y);
        this.point(this.perimeters[0].x, this.perimeters[0].y);
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.stroke();
        this.ctx.fill();
        break;
      case 'pen':
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.ctx.beginPath();
        this.ctx.moveTo(this.perimeters[0].x, this.perimeters[0].y);
        for (var i = 1; i < this.perimeters.length; i++) {
          this.ctx.lineTo(this.perimeters[i].x, this.perimeters[i].y);
        }
        if (end) {
          this.ctx.lineTo(this.perimeters[0].x, this.perimeters[0].y);
          this.ctx.closePath();
          this.ctx.strokeStyle = 'blue';
          this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          this.ctx.stroke();
          this.ctx.fill();
        } else {
          this.ctx.stroke();
        }
        break;
      case 'circle':
        this.perimeters = [];
        var radiusX = (this.target_x - this.origin_x) * 0.5;  // x반경
        var radiusY = (this.target_y - this.origin_y) * 0.5;  // y반경
        var centerX = this.origin_x + radiusX;                // 중심점 x좌표
        var centerY = this.origin_y + radiusY;                // 중심점 y좌표
        var step = 0.01;                                      // 타원(원)의 걸음수
        var a = step;                                         // counter
        var pi2 = Math.PI * 2 - step;                         // 마감각도
        this.hRight = { x: centerX + radiusX, y: centerY };
        for (; a < pi2; a += step) {
          if (a <= Math.PI / 2 + step && a >= Math.PI / 2 - step) {
            this.vBottom = { x: parseInt(centerX + radiusX * Math.cos(a)), y: parseInt(centerY + radiusY * Math.sin(a)) };
            this.perimeters.push(this.vBottom);
            continue;
          }
          if (a <= Math.PI + step && a >= Math.PI - step) {
            this.hLeft = { x: parseInt(centerX + radiusX * Math.cos(a)), y: parseInt(centerY + radiusY * Math.sin(a)) };
            this.perimeters.push(this.hLeft);
            continue;
          }
          if (a <= Math.PI * 1.5 + step && a >= Math.PI * 1.5 - step) {
            this.vTop = { x: parseInt(centerX + radiusX * Math.cos(a)), y: parseInt(centerY + radiusY * Math.sin(a)) };
            this.perimeters.push(this.vTop);
            continue;
          }
          this.perimeters.push({ x: parseInt(centerX + radiusX * Math.cos(a)), y: parseInt(centerY + radiusY * Math.sin(a)) });
        }
        this.ctx.strokeStyle = 'blue';
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.ctx.beginPath();
        this.ctx.moveTo(this.perimeters[0].x, this.perimeters[0].y);
        for (var i = 1; i < this.perimeters.length; i++) {
          this.ctx.lineTo(this.perimeters[i].x, this.perimeters[i].y);
        }
        this.ctx.lineTo(this.perimeters[0].x, this.perimeters[0].y);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
        break;
      case 'magic_wand':
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.ctx.beginPath();
        for (var i = 0; i < this.perimeters.length; i++) {
          if (i == 0) {
            this.ctx.moveTo(this.perimeters[i].x, this.perimeters[i].y);
          } else {
            this.ctx.lineTo(this.perimeters[i].x, this.perimeters[i].y);
          }
        }
        if (end) {
          this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
          this.ctx.lineTo(this.perimeters[0].x, this.perimeters[0].y);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          this.ctx.fill();
          this.ctx.strokeStyle = 'blue';
        }
        this.ctx.stroke();
        break;
    }
  }

  /* 정점들의 배렬 perimeters[]에 기초하여 다각형의 매 변의 길이를 현시하는 함수 */
  private drawLabels(end: boolean = false) {
    if (this.perimeters.length == 1) return;
    let temp_perimeters = [];
    if (this.selected_tool == 'circle') {
      var center = { x: this.origin_x + (this.target_x - this.origin_x) / 2, y: this.origin_y + (this.target_y - this.origin_y) / 2 };
      temp_perimeters.push(center, this.hLeft, center, this.vBottom, center, this.hRight, center, this.vTop);
      this.ctx.beginPath();
      this.ctx.strokeStyle = 'blue';
      this.ctx.moveTo(temp_perimeters[0].x, temp_perimeters[0].y);
      for (var i = 1; i < temp_perimeters.length; i++) {
        if (i % 2 == 1) {
          this.ctx.lineTo(temp_perimeters[i].x, temp_perimeters[i].y);
          this.point(temp_perimeters[i].x, temp_perimeters[i].y);
          this.ctx.stroke();
        } else {
          this.ctx.moveTo(temp_perimeters[i].x, temp_perimeters[i].y);
        }
      }
      this.ctx.closePath();
    } else {
      temp_perimeters = [...this.perimeters];
    }
    if (end) temp_perimeters.push(this.perimeters[0]);
    for (var id = 1; id < temp_perimeters.length; id++) {
      var len_mp = this.getLenMpAngle(temp_perimeters[id], temp_perimeters[id - 1]);
      this.ctx.beginPath();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = 'white';
      this.ctx.save();
      this.ctx.translate(len_mp['mp']['x'], len_mp['mp']['y']);
      this.ctx.rotate(len_mp['ang']);
      this.ctx.fillStyle = "black";
      this.ctx.rect(-25, -15, 50, 15);
      this.ctx.fillRect(-25, -15, 50, 15);
      this.ctx.fillStyle = "white";
      this.ctx.font = "15px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(len_mp['len'], 0, -2);
      this.ctx.stroke();
      this.ctx.restore();
      this.ctx.closePath();
    }
  }

  /* 두 점의 위치정보에 기초하여 두 점사이 길이를 현시하는 본문의 위치, 각도계산함수 */
  private getLenMpAngle(point1 = null, point2 = null) {
    if (point1.x == null || point2.x == null || point1.y == null || point2.y == null) return;
    var len = Math.sqrt(Math.pow((point1.x - point2.x), 2) + Math.pow((point1.y - point2.y), 2));
    var mid_point = { x: Math.floor(point1.x + point2.x) / 2, y: Math.floor(point1.y + point2.y) / 2 };
    let vect = { 'x': point1.x - point2.x, 'y': point1.y - point2.y };
    let angle = Math.atan(vect['y'] / vect['x']);
    // return { len: (len / this.zoom_scale).toFixed(2), mp: mid_point, ang: angle };
    return { len: (len / this.zoom_scale).toFixed(2), mp: mid_point, ang: angle };
  }

  /* 점하이라이트함수: 좌표가 주어질 때 점주위에 직사각형을 그려주는 함수 */
  private point(x: number, y: number) {
    this.ctx.fillStyle = 'red';
    this.ctx.fillRect(x - 3, y - 3, 6, 6);
  }

  /* 배경화상정보에 기초하여 magic wand에 해당한 다각형그리는 함수 */
  drawMask(x: number, y: number) {
    if (!this.imageInfo) return;
    var image = {
      data: this.imageInfo.data.data,
      width: this.imageInfo.width,
      height: this.imageInfo.height,
      bytes: 4
    };
    this.mask = MagicWand.floodFill(image, x, y, 15, null, true);
    this.mask = MagicWand.gaussBlurOnlyBorder(this.mask, 5);
    this.drawBorder();
  }

  /* magic wand에 의해 선택되는 도형의 경계그리기 및 경계점들을 정점배렬 perimeters[]에 보관하는 함수 */
  drawBorder() {
    if (!this.mask) return;
    console.log('drawBorder함수내부');
    var x, y, i, j, k, w = this.imageInfo.width, h = this.imageInfo.height;
    var context = this.imageInfo.context;
    var imgData = context.createImageData(w, h);
    var res = imgData.data;
    var cacheInd = MagicWand.getBorderIndices(this.mask);
    context.clearRect(0, 0, w, h);
    var len = cacheInd.length;
    var coordsarray = [];
    for (j = 0; j < len; j++) {
      i = cacheInd[j];
      x = i % w; // calc x by index
      y = (i - x) / w; // calc y by index
      k = (y * w + x) * 4;
      res[k + 3] = 255;
      coordsarray.push({ x: x, y: y });
    }
    context.putImageData(imgData, 0, 0);
    var tmp_perimeters = [];
    tmp_perimeters = this.findPerimetersUsingGreedy(coordsarray);
    for (i = 0; i < tmp_perimeters.length; i += 10) {
      this.perimeters.push(tmp_perimeters[i]);
    }
    this.draw(true, this.selected_tool);
  }

  /* magic wand기능수행시 다각형내에 다른 다각형이 놓이는 경우제거를 위한 함수 */
  findPerimetersUsingGreedy(coordsarray) {
    if (coordsarray == []) return;
    let id = 0;
    let min_distance;
    let id_array = [];
    let x, y, x1, y1;
    let subid = 0;
    let array_len = coordsarray.length;
    let x0 = coordsarray[0]['x'];
    let y0 = coordsarray[0]['y'];
    let distance_to_0 = 0;
    var dist = 0;
    while (id < array_len) {
      subid = id + 1;
      if (subid == array_len) break;
      x = coordsarray[id]['x'];
      y = coordsarray[id]['y'];
      x1 = coordsarray[subid]['x'];
      y1 = coordsarray[subid]['y'];
      distance_to_0 = Math.sqrt(Math.pow(x - x0, 2) + Math.pow(y - y0, 2));

      min_distance = Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
      while (subid < array_len) {
        x1 = coordsarray[subid]['x'];
        y1 = coordsarray[subid]['y'];
        dist = Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
        if (dist < min_distance) {
          min_distance = dist;
          id_array.push(subid);
        }
        subid += 1;
      }
      if (min_distance > distance_to_0 && id > (array_len * 2 / 3)) {
        return coordsarray.slice(0, id);
      }
      if (id_array.length !== 0) {  // 값교환 
        let swap_id = id_array[id_array.length - 1];
        let tmp = {};
        tmp['x'] = coordsarray[id + 1]['x'];
        tmp['y'] = coordsarray[id + 1]['y'];
        coordsarray[id + 1]['x'] = coordsarray[swap_id]['x'];
        coordsarray[id + 1]['y'] = coordsarray[swap_id]['y'];
        coordsarray[swap_id]['x'] = tmp['x'];
        coordsarray[swap_id]['y'] = tmp['y'];
      }
      id_array = [];
      id += 1;
    }
    return coordsarray;
  }

  /* line들사이 교차(충돌)여부검사: 아래의 lineIntersects()를 호출 */
  checkIntersects(x: number, y: number) {
    if (this.perimeters.length < 4) { return false; }
    var p0 = new Array();
    var p1 = new Array();
    var p2 = new Array();
    var p3 = new Array();
    p2['x'] = this.perimeters[this.perimeters.length - 1].x;
    p2['y'] = this.perimeters[this.perimeters.length - 1].y;
    p3['x'] = x;
    p3['y'] = y;
    for (var i = 0; i < this.perimeters.length - 1; i++) {
      p0['x'] = this.perimeters[i].x;
      p0['y'] = this.perimeters[i].y;
      p1['x'] = this.perimeters[i + 1].x;
      p1['y'] = this.perimeters[i + 1].y;
      if (p1['x'] == p2['x'] && p1['y'] == p2['y']) { continue; }
      if (p0['x'] == p3['x'] && p0['y'] == p3['y']) { continue; }
      if (this.lineIntersects(p0, p1, p2, p3)) { return true; }
    }
    return false;
  }

  /* 4개의 점의 교차여부검사 */
  lineIntersects(p0, p1, p2, p3) {
    var s1_x, s1_y, s2_x, s2_y;
    s1_x = p1['x'] - p0['x'];
    s1_y = p1['y'] - p0['y'];
    s2_x = p3['x'] - p2['x'];
    s2_y = p3['y'] - p2['y'];
    var s, t;
    s = (-s1_y * (p0['x'] - p2['x']) + s1_x * (p0['y'] - p2['y'])) / (-s2_x * s1_y + s1_x * s2_y);
    t = (s2_x * (p0['y'] - p2['y']) - s2_y * (p0['x'] - p2['x'])) / (-s2_x * s1_y + s1_x * s2_y);
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) { return true; }  // 충돌검출
    return false;                                               // 충돌없음
  }

  /* 점(x, y)이 perimeters[]배렬에 이미 있는가 즉 사용자가 이미 그린 점을 다시 click했을 여부검사 */
  checkPerimeterPointClicked(x, y, perimeters) {
    var len = -1;
    if (perimeters != null) {
      len = perimeters.length - 1;
      while (len > -1) {
        if (x > perimeters[len]['x'] - 10 && x < perimeters[len]['x'] + 10 &&
          y > perimeters[len]['y'] - 10 && y < perimeters[len]['y'] + 10) {
          return len;
        }
        len -= 1;
      }
    }
    return len;
  }

  /* 정점들의 배렬 perimeters[]에 기초하여 다각형의 면적계산 */
  calculateAreaPerimeter(coordsarray) {
    var area = 0;
    var perimeter_length = 0;
    var tmp = new Array();
    coordsarray.forEach(elem => tmp.push(elem));
    tmp.push(coordsarray[0]);
    var id = 0;
    while (id < tmp.length - 1) {
      area += (tmp[id]['x'] * tmp[id + 1]['y'] - tmp[id + 1]['x'] * tmp[id]['y']);
      if (id != tmp.length - 1) {
        perimeter_length += Math.sqrt((tmp[id]['x'] - tmp[id + 1]['x']) * (tmp[id]['x'] - tmp[id + 1]['x']) + (tmp[id]['y'] - tmp[id + 1]['y']) * (tmp[id]['y'] - tmp[id + 1]['y']));
      }
      id += 1;
    }
    area = area / Math.pow(this.zoom_scale, 2);
    perimeter_length = perimeter_length / this.zoom_scale;
    var result = { area: Math.abs(area / 2).toFixed(2), perimeter: perimeter_length.toFixed(2) };
    return result;
  }

  /* 배경화상재그리기 */
  redraw() {
    var p1 = { x: 0, y: 0 };
    var p2 = { x: this.scene.width, y: this.scene.height };
    console.log('************* ' + p1.x + " : " + p1.y + "   " + p2.x + " : " + p2.y + " *************");
    console.log('************* ' + this.scene.width + " X " + this.scene.height + " *************");
    this.sceneCtx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    var width = this.imgElement.nativeElement.width;
    var height = this.imgElement.nativeElement.height;
    this.sceneCtx.drawImage(this.imgElement.nativeElement, (this.rect.right - width - 280) / 2, (this.rect.bottom - height - 70) / 2);
  }
}