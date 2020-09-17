import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { switchMap, takeUntil, pairwise } from 'rxjs/operators';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { saveAs } from 'file-saver';

export const tooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 500,
  hideDelay: 500,
  touchendHideDelay: 500,
};

@Component({
  selector: 'vex-xcope',
  templateUrl: './xcope.component.html',
  styleUrls: ['./xcope.component.scss'],
  providers: [{ provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: tooltipDefaults }],
})

export class XcopeComponent implements AfterViewInit {

  @ViewChild('canvas') canvasElement: ElementRef;
  @ViewChild('background') imgElement: ElementRef;

  line_tool_card_display = false;
  magic_wand_tool_card_display = false;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rect = null;
  private imageBackground = new Image();

  mousedown = null;
  mousemove = null;
  mouseup = null;

  isMouseDown = false;

  selected_tool = '';
  perimeters = [];
  origin_x = null; origin_y = null;
  target_x = null; target_y = null;

  selected_unit = 'cm';

  constructor() { }

  ngAfterViewInit() {
    this.canvas = this.canvasElement.nativeElement;
    this.canvas.width = window.innerWidth - 280; // 280: left sidebar너비
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d');
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
      }
    });

    /* canvas에 대한 mousemove */
    this.mousemove = fromEvent(canvasEl, 'mousemove').subscribe((res: MouseEvent) => {
      switch (_selected_tool) {
        case 'rectangle':
          if (this.isMouseDown) {
            this.target_x = res.clientX - this.rect.left;
            this.target_y = res.clientY - this.rect.top;
            this.perimeters = [];
            this.perimeters.push({ x: this.origin_x, y: this.origin_y });
            this.perimeters.push({ x: this.target_x, y: this.target_y });
            this.draw(true, _selected_tool);
          }
          break;
        case 'pen':
          if (this.isMouseDown) {
            this.perimeters.push({ x: res.clientX - this.rect.left, y: res.clientY - this.rect.top });
            if (Math.abs(res.clientX - this.rect.left - this.perimeters[0].x) <= 3 && Math.abs(res.clientY - this.rect.top - this.perimeters[0].y) <= 3) {
              this.draw(true, _selected_tool);
            } else {
              this.draw(false, _selected_tool);
            }
          }
          break;
        case 'circle':
          if (this.isMouseDown) {
            this.target_x = res.clientX - this.rect.left;
            this.target_y = res.clientY - this.rect.top;
            this.draw(false, _selected_tool);
          }
          break;
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
        break;
      case 'magic_wand_tool':
        this.magic_wand_tool_card_display = !this.magic_wand_tool_card_display;
        this.line_tool_card_display = false;
        break;
      case 'settings':
        this.line_tool_card_display = false;
        this.magic_wand_tool_card_display = false;
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        break;
      case 'clear_canvas':
        this.line_tool_card_display = false;
        this.magic_wand_tool_card_display = false;
        this.perimeters = [];
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        break;
      case 'export':
        console.log(this.perimeters);
        var blob = new Blob([JSON.stringify(this.perimeters)], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, 'perimeters.json');
        break;
      case 'print':
        window.print();
        break;
      case 'import':
        console.log('화일선택하였음.');
        this.readImage(event);
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

  readImage(event) {
    console.log(event.target.files[0].name);
    var width = this.imgElement.nativeElement.width;
    var height = this.imgElement.nativeElement.height;
    this.ctx.drawImage(this.imgElement.nativeElement, (this.rect.right - width - 280) / 2, (this.rect.bottom - height - 70) / 2);
    // if (event.target.files && event.target.files[0]) {
    //   var reader = new FileReader();
    //   // reader.onload = e => {
    //   //   console.log('화상 onload함수내부');
    //   //   this.ctx.clearRect(0, 0, this.rect.left, this.rect.bottom);
    //   //   this.imageBackground.src = Buffer.from(e.target.result).toString();
    //   //   setTimeout(() => {
    //   //     console.log('setTimeout함수내부');
    //   //   }, 1000);
    //   // }
    //   reader.onload = () => {

    //   }
    //   reader.readAsDataURL(event.target.files[0]);
    // }
  }
}

