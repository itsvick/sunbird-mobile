import {NgModule} from '@angular/core';
import {IonicPageModule} from 'ionic-angular';
import {ActiveDownloadsPage} from './active-downloads';
import {FileSizePipe} from '@app/pipes/file-size/file-size';
import {PipesModule} from '@app/pipes/pipes.module';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
    ActiveDownloadsPage,
  ],
  imports: [
    IonicPageModule.forChild(ActiveDownloadsPage),
    PipesModule,
    TranslateModule.forChild(),
  ],
  providers: [
    FileSizePipe
  ]
})
export class ActiveDownloadsPageModule {
}
