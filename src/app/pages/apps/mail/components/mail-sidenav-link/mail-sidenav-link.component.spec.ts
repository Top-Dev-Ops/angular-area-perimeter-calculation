import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MailSidenavLinkComponent } from './mail-sidenav-link.component';

describe('MailSidenavLinkComponent', () => {
  let component: MailSidenavLinkComponent;
  let fixture: ComponentFixture<MailSidenavLinkComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MailSidenavLinkComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MailSidenavLinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
