import { Component, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { fromEvent } from 'rxjs';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { saveAs } from 'file-saver';
import MagicWand from 'magic-wand-tool';
import html2canvas from 'html2canvas';
import { MapsAPILoader } from '@agm/core';

export const tooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 200,
  hideDelay: 200,
  touchendHideDelay: 200,
};

@Component({
  selector: 'vex-xcope',
  templateUrl: './xcope.component.html',
  styleUrls: ['./xcope.component.scss'],
  providers: [{ provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: tooltipDefaults }]
})

export class XcopeComponent implements AfterViewInit {

  /* html elements */
  @ViewChild('canvas') canvasElement: ElementRef;
  @ViewChild('canvas_background') sceneElement: ElementRef;
  @ViewChild('background') imgElement: ElementRef;
  @ViewChild('map') mapElement: ElementRef;
  @ViewChild('search') searchElement: ElementRef;

  /* object variables from html elements */
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scene: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;
  private rect = null;

  /* variables used in html (ng-model like) */
  line_tool_card_display = false;       // display status for card of detailed tools of line
  magic_wand_tool_card_display = false; // display status for card of detailed tools of magic wand
  scale_factor = 5;                     // scale factor of map(default 1:5)
  selected_unit = 'cm';                 // unit(cm, m, in)
  hide_canvas = 'HIDE CANVAS';          // HIDE CANVAS / SHOW CANVAS
  hide_image = 'HIDE IMAGE';            // HIDE IMAGE / SHOW IMAGE
  area_length = 1;                      // length of perimeter/area panel by clicking + button(at the bottom right) - max: 10
  perimeters_list = [];                 // perimeters' aray of 10 polygons(stores perimeters by the length of area_length, the remaining is empty)
  points_list = [];                     // points' array of 10 polygons(stores points by the length of area_length, the remaining is empty)
  perimeter_list = [];                  // perimeter array of 10 polygons(stores perimeter by the length of area_length, the remaining is 0)
  area_list = [];                       // area array of 10 polygons(stores area by the length of area_length, the remaining is 0)
  selected_area = 1;                    // index of the selected perimeter/area panel out of 10
  area_details_show = false;            // visible status of area panel converted by other unit
  current_area = 0;                     // current area
  square_index = 0;                     // square index of 10 when converting current area to another
  lat = 31.224361;                      // latitude(google map)
  lng = 121.469170;                     // longitude(google map)
  show_map = false;                     // decides to display map or background
  map_zIndex = true;                    // decides if map is placed on canvas or under
  address: string;
  private geoCoder;

  /* mouse events on canvas */
  mousedown = null;
  mousemove = null;
  mouseup = null;
  mousewheel = null;
  /* decides whether the mouse is clicked when mousemove */
  isMouseDown = false;
  isDraggable = false;

  /* variables used in controller */
  selected_tool = '';                                       // currently selected tool. e.g. 'line', 'rectangle'...
  last_selected_tool = '';                                  // lastly selected tool. e.g. 'line', 'rectangle'...
  perimeters = [];                                          // array of points of polygon
  origin_x = null; origin_y = null;                         // start point - point position when mouse is clicked
  target_x = null; target_y = null;                         // end point - point position when mouse is released
  zoom_scale = 1;                                           // zoom scale of background image(changes when mouse wheel, square of 1.1)
  zoom_direction = 0;                                       // direction of zoom of background(zoom_in: 1, zoom_out: -1, otherwise: 0)
  drag_start: any;                                          // mouse click poing when panning background
  hLeft = null; hRight = null; vTop = null; vBottom = null; // horizontal and vertical points when drawing a circle
  imageInfo = null;                                         // includes all information of scene(background - performs magic wand function based on imageInfo)
  mask = null;                                              // variable when performing magic wand
  selected_vertex_id = -1;

  constructor(private mapsAPILoader: MapsAPILoader, private ngZone: NgZone) {
    for (var i = 0; i < 10; i++) {
      this.perimeter_list.push(0);
      this.area_list.push(0);
    }
    this.setCurrentLocation();
  }

  /* initializes all variables */
  ngAfterViewInit() {
    this.canvas = this.canvasElement.nativeElement;
    this.scene = this.sceneElement.nativeElement;
    this.canvas.width = window.innerWidth - 280; // 280: left sidebar width
    this.canvas.height = window.innerHeight;
    this.scene.width = window.innerWidth - 280;
    this.scene.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d');
    this.sceneCtx = this.scene.getContext('2d');
    this.rect = this.canvas.getBoundingClientRect();

    this.mapsAPILoader.load().then(() => {
      // this.setCurrentLocation();
      this.geoCoder = new google.maps.Geocoder;

      let autocomplete = new google.maps.places.Autocomplete(this.searchElement.nativeElement);
      autocomplete.addListener("place_changed", () => {
        this.ngZone.run(() => {
          let place: google.maps.places.PlaceResult = autocomplete.getPlace();
          if (place.geometry === undefined || place.geometry === null) { return; }

          this.lat = place.geometry.location.lat();
          this.lng = place.geometry.location.lng();
        });
      });
    });
  }

  /* gets current location of the user */
  private setCurrentLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        this.lat = position.coords.latitude;
        this.lng = position.coords.longitude;
        this.getAddress(this.lat, this.lng);
      });
    }
  }

  markerDragEnd($event: any) {
    console.log($event);
    this.lat = $event.coords.lat;
    this.lng = $event.coords.lng;
    this.getAddress(this.lat, this.lng);
  }

  /* gets address with latitude and longitude */
  getAddress(latitude, longitude) {
    this.geoCoder.geocode({ 'location': { lat: latitude, lng: longitude } }, (results, status) => {
      console.log(results, status);
      if (status === 'OK') {
        if (results[0]) {
          this.address = results[0].formatted_address;
        } else {
          window.alert('No results found.');
        }
      } else {
        window.alert('Geocoder failed due to: ' + status);
      }
    });
  }

  /* shows/hides the detailed tools card when clicking the primary tool, selects the tool, shows/hides settings menu of topbar... */
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
        this.sceneCtx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.canvas.style.cursor = 'default';
        this.show_map = false;
        break;
      case 'export':
        var blob = new Blob([JSON.stringify(this.perimeters)], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, 'perimeters.json');
        this.canvas.style.cursor = 'default';
        break;
      case 'print':
        this.canvas.style.cursor = 'default';
        html2canvas(document.body).then(function (canvas) {
          var tWindow = window.open('');
          tWindow.document.body.appendChild(canvas);
          tWindow.focus();
          tWindow.print();
        });
        break;
      case 'import':
        this.zoom_scale = 1;
        this.zoom_direction = 0;
        this.readImage(event);
        this.canvas.style.cursor = 'default';
        this.show_map = false;
        break;
      case 'hand':
        this.canvas.style.cursor = 'move';
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        this.perimeters = [];
        break;
      case 'plus':
        this.line_tool_card_display = false;
        this.magic_wand_tool_card_display = false;
        if (this.perimeters.length == 0) {
          alert('Please draw a polygon to move to another canvas.');
          return;
        }
        this.perimeters_list.push(this.perimeters);
        if (this.last_selected_tool == 'circle') {
          this.points_list.push([this.hRight, this.vBottom, this.hLeft, this.vTop]);
        } else if (this.last_selected_tool == 'pen') {
          this.points_list.push([this.perimeters[0]]);
        } else {
          this.points_list.push(this.perimeters);
        }
        this.area_length = this.area_length > 10 ? 10 : this.area_length + 1;
        this.selected_area = this.area_length;
        this.perimeters = [];
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        break;
      case 'area_plus':
        if (this.perimeters_list.length < this.area_length) {
          this.perimeters_list.push(this.perimeters);
          if (this.last_selected_tool == 'circle') {
            this.points_list.push([this.hRight, this.vBottom, this.hLeft, this.vTop]);
          } else if (this.last_selected_tool == 'pen') {
            this.points_list.push(this.perimeters[0]);
          } else {
            this.points_list.push(this.perimeters);
          }
        }
        this.perimeters = [];
        this.selected_area = parseInt(event.target.innerText);
        this.perimeters_list[this.selected_area - 1].forEach(element => this.perimeters.push(element));
        this.draw(true, 'area_plus');                                                 // draws a polygon
        this.points_list[this.selected_area - 1].forEach(element => {                 // highlights a point
          this.point(element.x, element.y);
        });
        this.calculateAreaDetails(this.calculateAreaPerimeter(this.perimeters).area); // displays the area
        break;
      case 'zoom_in':
        this.canvas.style.cursor = 'zoom-in';
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        break;
      case 'zoom_out':
        this.canvas.style.cursor = 'zoom-out';
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        break;
      case 'show_map':
        this.show_map = !this.show_map;
        this.map_zIndex = true;
        break;
      default:
        this.line_tool_card_display = false;
        this.magic_wand_tool_card_display = false;
        this.map_zIndex = false;
        this.last_selected_tool = tool;
        this.uncaptureEvents();
        this.captureEvents(this.canvas, tool);
        this.perimeters = [];
        break;
    }
  }

  /* displays the image in the scene after selecting the background by clicking import menu */
  readImage(event) {
    if (event.target.files && event.target.files[0]) {
      if (event.target.files[0].name.includes('.pdf')) {    // pdf
        console.log('selects pdf');
      } else {                                              // image
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
  }

  /* canvas mouse event subscribe: activated when the user selects the tool */
  private captureEvents(canvasEl: HTMLCanvasElement, _selected_tool: string) {

    /* canvas mousedown */
    this.mousedown = fromEvent(canvasEl, 'mousedown').subscribe((res: MouseEvent) => {
      var x = res.clientX - this.rect.left;
      var y = res.clientY - this.rect.top;
      switch (_selected_tool) {
        case 'line':
          if (this.perimeters.length > 0 && this.checkPerimeterPointClicked(x, y, this.perimeters) == 0) {
            if (this.perimeters.length == 2) {
              alert('You need at least 3 points to draw a polygon.');
              return false;
            }
            x = this.perimeters[0].x;
            y = this.perimeters[0].y;
            if (this.checkIntersects(x, y)) {
              alert('Error: The line you are drawing is intersecting other lines.');
              return false;
            }
            this.draw(true, _selected_tool);
            this.drawLabels(true);
            this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
            this.area_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).area;
            res.preventDefault();
            this.uncaptureEvents();
            return false;
          }
          if (this.perimeters.length > 0 && x == this.perimeters[this.perimeters.length - 1]['x'] && y == this.perimeters[this.perimeters.length - 1]['y']) {
            return false; // double clicked the same point
          }
          if (this.checkIntersects(x, y)) {
            alert('Error: The line you are drawing is intersecting other lines.');
            return false;
          }
          this.perimeters.push({ x: x, y: y });
          this.draw(false, _selected_tool);
          this.drawLabels();
          this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
          break;
        case 'rectangle':
          this.isMouseDown = true;
          this.origin_x = x;
          this.origin_y = y;
          var clicked_id = this.checkPerimeterPointClicked(x, y, this.perimeters);
          if (clicked_id != -1) {
            this.canvas.style.cursor = 'crosshair';
            this.selected_vertex_id = clicked_id;
          }
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
          if (this.vTop != null) {
            if (x >= parseInt(this.vTop.x) - 10 && x <= parseInt(this.vTop.x) + 10 && y >= parseInt(this.vTop.y) - 10 && y <= parseInt(this.vTop.y) + 10) {
              this.selected_vertex_id = 0;
            }
            if (x >= parseInt(this.vBottom.x) - 10 && x <= parseInt(this.vBottom.x) + 10 && y >= parseInt(this.vBottom.y) - 10 && y <= parseInt(this.vBottom.y) + 10) {
              this.selected_vertex_id = 1;
            }
          }
          break;
        case 'hand':
          this.isDraggable = true;
          this.drag_start = { x: res.offsetX || x, y: res.offsetY || y };
          break;
        case 'magic_wand':
          this.perimeters = [];
          this.drawMask(x, y);
          this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
          this.area_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).area;
          break;
        case 'zoom_in':
          this.zoom_scale *= 1.1;
          this.zoom_direction = 1;
          this.zoom();
          break;
        case 'zoom_out':
          this.zoom_scale /= 1.1;
          this.zoom_direction = -1;
          this.zoom();
          break;
      }
    });

    /* canvas mouseup */
    this.mouseup = fromEvent(canvasEl, 'mouseup').subscribe((res: MouseEvent) => {
      switch (_selected_tool) {
        case 'rectangle':
          this.isMouseDown = false;
          this.selected_vertex_id = -1;
          this.canvas.style.cursor = 'default';
          break;
        case 'pen':
          this.isMouseDown = false;
          break;
        case 'circle':
          this.isMouseDown = false;
          this.selected_vertex_id = -1;
          this.canvas.style.cursor = 'default';
          break;
        case 'hand':
          this.isDraggable = false;
          this.drag_start = null;
          this.imageInfo.data = this.sceneCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          break;
      }
    });

    /* canvas mousemove */
    this.mousemove = fromEvent(canvasEl, 'mousemove').subscribe((res: MouseEvent) => {
      var x = res.clientX - this.rect.left;
      var y = res.clientY - this.rect.top;
      this.canvas.style.cursor = this.checkPerimeterPointClicked(x, y, this.perimeters) != -1 ? 'crosshair' : 'default';
      switch (_selected_tool) {
        case 'rectangle':
          if (this.isMouseDown) {
            if (this.selected_vertex_id != -1) {
              this.perimeters[this.selected_vertex_id].x = x;
              this.perimeters[this.selected_vertex_id].y = y;
              this.draw(true, _selected_tool);
              this.drawLabels(true);
              this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
              this.area_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).area;
              break;
            }
            this.target_x = x;
            this.target_y = y;
            this.perimeters = [];
            this.perimeters.push({ x: this.origin_x, y: this.origin_y });
            this.perimeters.push({ x: this.target_x, y: this.origin_y });
            this.perimeters.push({ x: this.target_x, y: this.target_y });
            this.perimeters.push({ x: this.origin_x, y: this.target_y });
            this.draw(true, _selected_tool);
            this.drawLabels(true);
            this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
            this.area_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).area;
          }
          break;
        case 'circle':
          if (this.isMouseDown) {
            /* if (this.selected_vertex_id == 0) {
              this.vTop.x = x;
              this.vTop.y = y;
              this.bezierCurve(this.hLeft, this.vTop, this.hRight, true);
              break;
            } else if (this.selected_vertex_id == 1) {
              this.vBottom.x = x;
              this.vBottom.y = y;
              this.bezierCurve(this.hLeft, this.vBottom, this.hRight, false);
              break;
            } */
            this.target_x = x;
            this.target_y = y;
            this.draw(true, _selected_tool);
            this.drawLabels(false);
            this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
            this.area_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).area;
          }
          break;
        case 'pen':
          if (this.isMouseDown) {
            this.perimeters.push({ x: x, y: y });
            if (Math.abs(x - this.perimeters[0].x) <= 3 && Math.abs(y - this.perimeters[0].y) <= 3) {
              this.draw(true, _selected_tool);
              this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
              this.area_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).area;
            } else {
              this.draw(false, _selected_tool);
              this.perimeter_list[this.area_length - 1] = this.calculateAreaPerimeter(this.perimeters).perimeter;
            }
          }
          break;
        case 'hand':
          if (this.drag_start) {
            var pt = { x: res.offsetX || x, y: res.offsetY || y };
            this.sceneCtx.translate(pt.x - this.drag_start.x, pt.y - this.drag_start.y);
            this.drag_start = { x: x, y: y };
            this.redraw();
          }
          break;
      }
    });

    /* canvas mousewheel */
    this.mousewheel = fromEvent(canvasEl, 'mousewheel').subscribe((res: WheelEvent) => {
      var delta = res.deltaY ? res.deltaY / 120 : res.detail ? -res.detail : 0;
      this.uncaptureEvents();
      if (delta) {
        if (delta > 0) {
          this.canvas.style.cursor = 'zoom-out';
          this.zoom_direction = -1;
          this.zoom_scale /= 1.1;
        } else {
          this.canvas.style.cursor = 'zoom-in';
          this.zoom_direction = 1;
          this.zoom_scale *= 1.1;
        }
        this.zoom();
      }
    });
  }

  /* canvas mouse events unsubscribe: deactivates */
  private uncaptureEvents() {
    if (this.mousedown != null) this.mousedown.unsubscribe();
    if (this.mouseup != null) this.mouseup.unsubscribe();
    if (this.mousemove != null) this.mousemove.unsubscribe();
  }

  /* zooms background */
  private zoom() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var xform = svg.createSVGMatrix();
    var pt = svg.createSVGPoint();
    var p1 = svg.createSVGPoint();
    var p2 = svg.createSVGPoint();
    pt.x = this.rect.right / 2;
    pt.y = this.rect.bottom / 2;
    p1.x = 0; p1.y = 0;
    p2.x = this.rect.right; p2.y = this.rect.bottom;
    pt = pt.matrixTransform(xform.inverse());
    p1 = p1.matrixTransform(xform.inverse());
    p2 = p2.matrixTransform(xform.inverse());
    this.sceneCtx.translate(pt.x, pt.y);
    if (this.zoom_direction == 1) {
      this.sceneCtx.scale(1.1, 1.1);
    } else if (this.zoom_direction == -1) {
      this.sceneCtx.scale(1 / 1.1, 1 / 1.1);
    }
    this.sceneCtx.translate(-pt.x, -pt.y);
    this.sceneCtx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    this.sceneCtx.drawImage(this.imgElement.nativeElement, (this.scene.width - this.imgElement.nativeElement.width) / 2, (this.scene.height - this.imgElement.nativeElement.height) / 2);
    this.imageInfo.data = this.sceneCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /* draws a polygon based on perimeters[] */
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
        this.ctx.strokeStyle = 'blue';
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.ctx.beginPath();
        if (this.selected_vertex_id != -1) {
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
        this.perimeters = [];
        var radiusX = (this.target_x - this.origin_x) * 0.5;  // x radius
        var radiusY = (this.target_y - this.origin_y) * 0.5;  // y radius
        var centerX = this.origin_x + radiusX;                // center x coordinate
        var centerY = this.origin_y + radiusY;                // center y coordinate
        var step = 0.01;                                      // step when drawing a ellipse(circle)
        var a = step;                                         // counter
        var pi2 = Math.PI * 2 - step;                         // end angle
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
      case 'area_plus':
        this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
        this.ctx.strokeStyle = 'blue';
        this.ctx.beginPath();
        this.ctx.moveTo(this.perimeters[0].x, this.perimeters[0].y);
        for (var i = 1; i < this.perimeters.length; i++) {
          this.ctx.lineTo(this.perimeters[i].x, this.perimeters[i].y);
        }
        this.ctx.lineTo(this.perimeters[0].x, this.perimeters[0].y);
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.stroke();
        this.ctx.fill();
        break;
    }
  }

  /* displays the length of every edge based on perimeters[] */
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

  /* calculates the position of text for displaying the length based on position of 2 points, calculates angle */
  private getLenMpAngle(point1 = null, point2 = null) {
    if (point1.x == null || point2.x == null || point1.y == null || point2.y == null) return;
    var len = Math.sqrt(Math.pow((point1.x - point2.x), 2) + Math.pow((point1.y - point2.y), 2));
    var mid_point = { x: Math.floor(point1.x + point2.x) / 2, y: Math.floor(point1.y + point2.y) / 2 };
    let vect = { 'x': point1.x - point2.x, 'y': point1.y - point2.y };
    let angle = Math.atan(vect['y'] / vect['x']);
    return { len: (len / this.zoom_scale).toFixed(2), mp: mid_point, ang: angle };
  }

  /* highlights the point: draws a rectangle around the point when coordinates are given */
  private point(x: number, y: number) {
    this.ctx.fillStyle = 'red';
    this.ctx.fillRect(x - 3, y - 3, 6, 6);
  }

  /* draws a polygon corresponding to magic wand based on background image */
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

  /* draws the edges of the polygon selected by magic wand, saves points array to perimeters[] */
  drawBorder() {
    if (!this.mask) return;
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
      x = i % w;          // calc x by index
      y = (i - x) / w;    // calc y by index
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

  /* draws a bezier curve that passes the left and right points when moving top and bottom points */
  bezierCurve(p0, p1, p2, place) {
    var temp_perimeter = new Array();
    var top_x = Math.floor(2 * p1.x - p0.x / 2 - p2.x / 2);
    var top_y = Math.floor(2 * p1.y - p0.y / 2 - p2.y / 2);
    var accuracy = 0.01;
    this.ctx.clearRect(0, 0, this.rect.right, this.rect.bottom);
    this.ctx.beginPath();
    this.ctx.strokeStyle = "#FF0000";
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    var point_met = false;
    var pass = false;
    if (this.perimeters.length === 0) return;
    if (place) {
      temp_perimeter.push({ x: this.hLeft.x, y: this.hLeft.y });
      for (var i = 0; i < 1.01; i += accuracy) {
        var line_x = Math.floor((1 - i) * (1 - i) * p0.x + 2 * (1 - i) * i * top_x + i * i * p2.x);
        var line_y = Math.floor((1 - i) * (1 - i) * p0.y + 2 * (1 - i) * i * top_y + i * i * p2.y);
        temp_perimeter.push({ x: line_x, y: line_y });
      }
      console.log('temp_perimeter: ' + temp_perimeter.length);
      console.log('perimeters: ' + this.perimeters.length);
      console.log(this.hLeft, this.vTop, this.hRight, this.vBottom);
      for (var i = 0; i < this.perimeters.length; i++) {
        if (parseInt(this.perimeters[i].x) == line_x && parseInt(this.perimeters[i].y) == line_y) {
          console.log('set point met to true: ' + i);
          point_met = true;
          i++;
        }
        if (parseInt(this.perimeters[i].x) == this.hLeft.x && parseInt(this.perimeters[i].y) == this.hLeft.y) {
          console.log('set point met to false: ' + i);
          point_met = false;
          i++;
        }
        if (point_met) {
          temp_perimeter.push(this.perimeters[i]);
        }
      }
      this.perimeters = new Array();
      temp_perimeter.forEach(elem => {
        this.perimeters.push(elem);
      });
      this.draw(true, 'circle');
    } else {
      temp_perimeter.push({ x: this.hRight.x, y: this.hRight.y });
      for (var i = 0; i < 1.01; i += accuracy) {
        line_x = Math.floor((1 - i) * (1 - i) * p2.x + 2 * (1 - i) * i * top_x + i * i * p0.x);
        line_y = Math.floor((1 - i) * (1 - i) * p2.y + 2 * (1 - i) * i * top_y + i * i * p0.y);
        temp_perimeter.push({ x: line_x, y: line_y });
      }
      var index = 0;
      this.perimeters.forEach(elem => {
        if (elem.x == this.hLeft.x && elem.y == this.hLeft.y) {
          point_met = true;
        } else {
          if (point_met) {
            pass = true;
            if (index == 0) {
              temp_perimeter.push(this.hLeft);
            }
            index++;
          }
        }
        if (elem.x == this.hRight.x && elem.y == this.hRight.y) {
          point_met = false;
        }
        if (point_met && pass) {
          temp_perimeter.push(elem);
        }
      });
      this.perimeters = new Array();
      temp_perimeter.forEach(elem => {
        this.perimeters.push(elem);
      });
      this.draw(true, 'circle');
    }
  };

  /* eliminates the case that the polygon is placed on another polygon when performing magic wand */
  findPerimetersUsingGreedy(coordsarray) {
    if (coordsarray == []) return;
    let id = 0;
    let min_distance;
    let id_array = [];
    let x, y, x1, y1;
    let subid = 0;
    let array_len = coordsarray.length;
    let x0 = coordsarray[0].x;
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
      if (id_array.length !== 0) {  // swaps the value
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

  /* checks whether lines are intersecting: calls lineIntersects() below */
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

  /* checks whether 4 points are conflicting */
  lineIntersects(p0, p1, p2, p3) {
    var s1_x, s1_y, s2_x, s2_y;
    s1_x = p1['x'] - p0['x'];
    s1_y = p1['y'] - p0['y'];
    s2_x = p3['x'] - p2['x'];
    s2_y = p3['y'] - p2['y'];
    var s, t;
    s = (-s1_y * (p0['x'] - p2['x']) + s1_x * (p0['y'] - p2['y'])) / (-s2_x * s1_y + s1_x * s2_y);
    t = (s2_x * (p0['y'] - p2['y']) - s2_y * (p0['x'] - p2['x'])) / (-s2_x * s1_y + s1_x * s2_y);
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) { return true; }  // detects conflict
    return false;                                               // no conflict
  }

  /* checks if point(x, y) exists in perimeters[] array, i.e. checks if the user clicked the point already drawn */
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

  /* calculates the area of polygon based on perimeters[] */
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

  /* converts the current area to other units */
  calculateAreaDetails(area) {
    this.current_area = area;
    this.square_index = 0;
    var b = 0;
    while (this.current_area > 10) {
      b = this.current_area / 10;
      b = ~~b;
      this.square_index++;
      this.current_area = b;
    }
    this.current_area = parseFloat((area / (10 ** this.square_index)).toFixed(2));
  }

  /* redraws the background image */
  redraw() {
    var p1 = { x: 0, y: 0 };
    var p2 = { x: this.scene.width, y: this.scene.height };
    this.sceneCtx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    var width = this.imgElement.nativeElement.width;
    var height = this.imgElement.nativeElement.height;
    this.sceneCtx.drawImage(this.imgElement.nativeElement, (this.rect.right - width - 280) / 2, (this.rect.bottom - height - 70) / 2);
  }

  /* initializes the variables */
  initializeVariables() {
    this.show_map = false;
  }
}