import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { VexRoutes } from '../../../../@vex/interfaces/vex-route.interface';
import { XcopeComponent } from './xcope.component';


const routes: VexRoutes = [
  {
    path: '',
    component: XcopeComponent,
    data: {
      toolbarShadowEnabled: true,
      scrollDisabled: true
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class XcopeRoutingModule {
}
