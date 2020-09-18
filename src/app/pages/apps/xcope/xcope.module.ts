import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { XcopeRoutingModule } from './xcope-routing.module';
import { XcopeComponent } from './xcope.component';
import { CalendarModule as AngularCalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { ScrollbarModule } from '../../../../@vex/components/scrollbar/scrollbar.module';
import { PageLayoutModule } from '../../../../@vex/components/page-layout/page-layout.module';
import { ContainerModule } from '../../../../@vex/directives/container/container.module';
import { IconModule } from '@visurel/iconify-angular';

@NgModule({
  declarations: [XcopeComponent],
  imports: [
    CommonModule,
    XcopeRoutingModule,
    AngularCalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory
    }),
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    ScrollbarModule,
    MatSnackBarModule,
    MatInputModule,
    MatDatepickerModule,
    MatCardModule,
    MatTooltipModule,
    MatMenuModule,
    MatSelectModule,
    ReactiveFormsModule,
    PageLayoutModule,
    MatNativeDateModule,
    IconModule,
    ContainerModule,
    FormsModule
  ],
  entryComponents: []
})
export class XcopeModule {
}
