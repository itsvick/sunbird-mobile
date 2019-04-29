import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams, Events, PopoverController, ViewController} from 'ionic-angular';
import { AppHeaderService } from '@app/service';
import { SbPopoverComponent } from './../../component/popups/sb-popover/sb-popover';
import { CommonUtilService } from '@app/service';
import { DownloadService} from 'sunbird-sdk';
import {ToastController} from 'ionic-angular';
/**
 * Generated class for the ActiveDownloadsPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-active-downloads',
  templateUrl: 'active-downloads.html',
})
export class ActiveDownloadsPage implements OnInit {
  headerObservable: any;
  networkSubscription: any;
  toast: any;
  headerConfig = {
    showHeader: true,
    showBurgerMenu: false,
    actionButtons: []
  };

  constructor(public navCtrl: NavController, public navParams: NavParams,
     private headerServie: AppHeaderService, private events: Events, private popoverCtrl: PopoverController,
     private commonUtilService: CommonUtilService, private viewCtrl: ViewController, private toastController: ToastController) {
  }

  ngOnInit() {
    // this.downloadService.getActiveDownloadRequest();
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad ActiveDownloadsPage');
  }
  ionViewWillEnter() {
    this.headerObservable = this.headerServie.headerEventEmitted$.subscribe(eventName => {
      this.handleHeaderEvents(eventName);
    });

    this.headerConfig = this.headerServie.getDefaultPageConfig();
    this.headerConfig.actionButtons = [];
    this.headerConfig.showBurgerMenu = false;
    this.headerServie.updatePageConfig(this.headerConfig);
    this.networkSubscription =  this.commonUtilService.networkAvailability$.subscribe((available: boolean) => {
      if  (available) {
        this.presentToastForOffline();
      } else {
        this.presentToastForOffline();
      }
    });
  }

  ionViewWillLeave() {
    if (this.networkSubscription) {
      this.networkSubscription.unsubscribe();
      if (this.toast) {
        this.toast.dismiss();
        this.toast = undefined;
      }
    }
  }

  handleHeaderEvents($event) {
    switch ($event.name) {
      case 'back':
      // this.telemetryGeneratorService.generateBackClickedTelemetry(PageId.COLLECTION_DETAIL, Environment.HOME,
      //   true, this.cardData.identifier, this.corRelationList);
      this.navCtrl.pop();
                    break;
    }
  }
  cancelActiveDownload() {
    // this.telemetryGeneratorService.generateInteractTelemetry(InteractType.TOUCH,
    //   InteractSubtype.KEBAB_MENU_CLICKED,
    //   Environment.HOME,
    //   PageId.CONTENT_DETAIL,
    //   undefined,
    //   undefined,
    //   this.objRollup,
    //   this.corRelationList);
    const confirm = this.popoverCtrl.create(SbPopoverComponent, {
      sbPopoverHeading: 'Cancel Download?',
      // sbPopoverMainTitle: this.commonUtilService.translateMessage('CONTENT_DELETE'),
      actionsButtons: [
        {
          btntext: 'Cancel Download',
          btnClass: 'popover-color'
        },
      ],
      icon: null,
      // metaInfo: this.content.contentData.name,
      sbPopoverMainTitle: 'Cancelling Download will remove the content from the Active Downloads',
    }, {
        cssClass: 'sb-popover danger',
      });
    confirm.present({
      ev: event
    });
    confirm.onDidDismiss((canDelete: any) => {
      if (canDelete) {
        this.deleteContent();
        this.viewCtrl.dismiss();
      }
    });
  }

  cancelAllActiveDownloads() {
    const confirm = this.popoverCtrl.create(SbPopoverComponent, {
      sbPopoverHeading: 'Cancel Downloads?',
      // sbPopoverMainTitle: this.commonUtilService.translateMessage('CONTENT_DELETE'),
      actionsButtons: [
        {
          btntext: 'Cancel Downloads',
          btnClass: 'popover-color'
        },
      ],
      icon: null,
      // metaInfo: this.content.contentData.name,
      sbPopoverMainTitle: 'Cancelling Download will remove the content from the Active Downloads',
    }, {
        cssClass: 'sb-popover danger',
      });
    confirm.present({
      ev: event
    });
    confirm.onDidDismiss((canDelete: any) => {
      if (canDelete) {
        this.deleteContent();
        this.viewCtrl.dismiss();
      }
    });
  }

  async presentToastForOffline() {
      this.toast =  await this.toastController.create({
    //  duration: 2000,
      message: this.commonUtilService.translateMessage('No Internet Connectivity') + ', Downloads' +
      +' will be resumed once the internet is back.',
      showCloseButton: true,
      position: 'top',
      closeButtonText: '',
      cssClass: 'toastAfterHeader'
    });
    this.toast.present();
    // .toast.onDidDismiss(() => {
    //   this.toast = undefined;
    // });
  }


  deleteContent() {

  }
}
