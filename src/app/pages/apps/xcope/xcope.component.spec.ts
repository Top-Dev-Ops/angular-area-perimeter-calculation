import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { XcopeComponent } from './xcope.component';

describe('XcopeComponent', () => {
  let component: XcopeComponent;
  let fixture: ComponentFixture<XcopeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [XcopeComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(XcopeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
