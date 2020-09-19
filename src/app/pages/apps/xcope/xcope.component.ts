import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { switchMap, takeUntil, pairwise } from 'rxjs/operators';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { saveAs } from 'file-saver';

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

  /* canvas에 대한 mouse사건들 */
  mousedown = null;
  mousemove = null;
  mouseup = null;
  mousewheel = null;
  /* mousemove시 마우스가 눌리워져있는가를 검사하는 변수 */
  isMouseDown = false;
  isDraggable = false;

  /* controller에서 리용하는 변수들 */
  selected_tool = '';               // 지금 선택된 도구의 이름. e.g. 'line', 'rectangle'...
  perimeters = [];                  // polygon의 점들의 배렬
  origin_x = null; origin_y = null; // 시작점-마우스를 눌렀을 때의 점위치
  target_x = null; target_y = null; // 마감점-마우스를 놓았을 때의 점위치
  zoom_scale = 1;                   // 배경화상의 확대/축소비률(mouse wheel사건시 변화)
  drag_start;

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

  /* canvas의 mouse사건함수 subscribe: 사용자가 도구를 선택하였을 때에만 사건이 활성화 */
  private captureEvents(canvasEl: HTMLCanvasElement, _selected_tool: string) {

    /* canvas에 대한 mousedown */
    this.mousedown = fromEvent(canvasEl, 'mousedown').subscribe((res: MouseEvent) => {
      var x = res.clientX - this.rect.left;
      var y = res.clientY - this.rect.top;
      switch (_selected_tool) {
        case 'line':
          if (this.perimeters.length > 0 && this.check_perimeter_pt_clicked(x, y, this.perimeters) == 0) {
            if (this.perimeters.length == 2) {
              alert('다각형을 구성하려면 적어도 3개의 점이 필요합니다.');
              return false;
            }
            x = this.perimeters[0].x;
            y = this.perimeters[0].y;
            if (this.check_intersects(x, y)) {
              alert('오유: 당신이 그리고있는 선이 다른 선과 교차합니다.');
              return false;
            }
            this.draw(true, _selected_tool);
            res.preventDefault();
            this.uncaptureEvents();
            return false;
          }
          if (this.perimeters.length > 0 && x == this.perimeters[this.perimeters.length - 1]['x'] && y == this.perimeters[this.perimeters.length - 1]['y']) {
            return false; // 같은 점을 double click
          }
          if (this.check_intersects(x, y)) {
            alert('오유: 당신이 그리고있는 선이 다른 선과 교차합니다.');
            return false;
          }
          this.perimeters.push({ x: x, y: y });
          this.draw(false, _selected_tool);
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
          console.log('hand도구선택후 canvas에 대한 mousedown');
          this.isDraggable = true;
          this.drag_start = this.transformedPoint(res.offsetX || x, res.offsetY || y);
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
          console.log('hand도구선택후 canvas에 대한 mouseup');
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
            this.perimeters.push({ x: this.target_x, y: this.target_y });
            this.draw(true, _selected_tool);
          }
          break;
        case 'pen':
          if (this.isMouseDown) {
            this.perimeters.push({ x: x, y: y });
            if (Math.abs(x - this.perimeters[0].x) <= 3 && Math.abs(y - this.perimeters[0].y) <= 3) {
              this.draw(true, _selected_tool);
            } else {
              this.draw(false, _selected_tool);
            }
          }
          break;
        case 'circle':
          if (this.isMouseDown) {
            this.target_x = x;
            this.target_y = y;
            this.draw(false, _selected_tool);
          }
          break;
        case 'hand':
          console.log('hand도구선택후 mousemove');
          if (this.drag_start) {
            var pt = this.transformedPoint(res.offsetX || x, res.offsetY || y);
            this.sceneCtx.translate(pt.x - this.drag_start.x, pt.y - this.drag_start.y);
            this.redraw();
          }
          break;
      }
    });

    /* canvas에 대한 mousewheel */
    this.mousewheel = fromEvent(canvasEl, 'mousewheel').subscribe((res: WheelEvent) => {
      var delta = res.deltaY ? res.deltaY / 120 : res.detail ? -res.detail : 0;
      console.log(delta);
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
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
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
        this.ctx.lineTo(this.perimeters[0].x, this.perimeters[1].y);
        this.ctx.lineTo(this.perimeters[1].x, this.perimeters[1].y);
        this.ctx.lineTo(this.perimeters[1].x, this.perimeters[0].y);
        this.ctx.lineTo(this.perimeters[0].x, this.perimeters[0].y);
        this.point(this.perimeters[0].x, this.perimeters[0].y);
        this.point(this.perimeters[0].x, this.perimeters[1].y);
        this.point(this.perimeters[1].x, this.perimeters[1].y);
        this.point(this.perimeters[1].x, this.perimeters[0].y);
        this.ctx.closePath();
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
        for (; a < pi2; a += step) {
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
    }
  }

  /* 점하이라이트함수: 좌표가 주어질 때 점주위에 직사각형을 그려주는 함수 */
  private point(x: number, y: number) {
    this.ctx.fillStyle = 'red';
    this.ctx.fillRect(x - 3, y - 3, 6, 6);
  }

  /* line들사이 교차(충돌)여부검사: 아래의 line_intersects()를 호출 */
  check_intersects(x: number, y: number) {
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
      if (this.line_intersects(p0, p1, p2, p3)) { return true; }
    }
    return false;
  }

  /* 4개의 점의 교차여부검사 */
  line_intersects(p0, p1, p2, p3) {
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
  check_perimeter_pt_clicked(x, y, perimeters) {
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

  /* 기본도구를 선택할 때 세부도구선택card의 현시 및 비현시, 세부도구선택, 또한 topbar의 settings메뉴 및 세부메뉴선택 */
  openTool(tool: string, event = null) {
    this.selected_tool = tool;
    switch (tool) {
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
        setTimeout(() => {
          this.sceneCtx.drawImage(this.imgElement.nativeElement, (this.rect.right - width - 280) / 2, (this.rect.bottom - height - 70) / 2);
        }, 500);
      }
      reader.readAsDataURL(event.target.files[0]);
    }
  }

  transformedPoint(x: number, y: number) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var xform = svg.createSVGMatrix();
    var pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(xform.inverse());
  }

  redraw() {
    console.log('redraw함수내부');
    var p1 = this.transformedPoint(0, 0);
    var p2 = this.transformedPoint(this.canvas.width, this.canvas.height);
    this.sceneCtx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    var width = this.imgElement.nativeElement.width;
    var height = this.imgElement.nativeElement.height;
    console.log(width + " : " + height);
    this.sceneCtx.drawImage(this.imgElement.nativeElement, (this.rect.right - width - 280) / 2, (this.rect.bottom - height - 70) / 2);
  }
}
