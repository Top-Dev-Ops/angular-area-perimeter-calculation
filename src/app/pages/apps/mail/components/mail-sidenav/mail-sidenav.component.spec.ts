import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MailSidenavComponent } from './mail-sidenav.component';

describe('MailSidenavComponent', () => {
  let component: MailSidenavComponent;
  let fixture: ComponentFixture<MailSidenavComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MailSidenavComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MailSidenavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
