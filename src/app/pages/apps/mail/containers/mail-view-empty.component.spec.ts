import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MailViewEmptyComponent } from './mail-view-empty.component';

describe('MailViewEmptyComponent', () => {
  let component: MailViewEmptyComponent;
  let fixture: ComponentFixture<MailViewEmptyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MailViewEmptyComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MailViewEmptyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
