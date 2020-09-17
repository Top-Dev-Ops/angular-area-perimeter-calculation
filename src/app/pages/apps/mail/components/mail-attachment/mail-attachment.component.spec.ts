import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MailAttachmentComponent } from './mail-attachment.component';

describe('MailAttachmentComponent', () => {
  let component: MailAttachmentComponent;
  let fixture: ComponentFixture<MailAttachmentComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MailAttachmentComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MailAttachmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
