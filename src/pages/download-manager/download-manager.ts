import {AppVersion} from '@ionic-native/app-version';
import {AppGlobalService, AppHeaderService, CommonUtilService, TelemetryGeneratorService} from '@app/service';
import {AppStorageInfo, DownloadManagerPageInterface, EmitedContents} from './download-manager.interface';
import {ContentType} from './../../app/app.constant';
import {Component, Inject, NgZone, OnInit} from '@angular/core';
import {Events, IonicPage, Loading, NavController, NavParams, Popover, PopoverController} from 'ionic-angular';
import {
  Content,
  ContentDeleteRequest,
  ContentDeleteResponse,
  ContentDeleteStatus,
  ContentRequest,
  ContentService,
  ContentSortCriteria,
  ContentSpaceUsageSummaryRequest,
  ContentSpaceUsageSummaryResponse,
  DeviceInfo,
  Profile,
  SortOrder,
  StorageService
} from 'sunbird-sdk';
import {SbPopoverComponent} from '@app/component';
import {ActiveDownloadsPage} from '../active-downloads/active-downloads';
import {Environment, InteractSubtype, InteractType, PageId} from '@app/service/telemetry-constants';
import {StorageSettingsPage} from '../storage-settings/storage-settings';
import {BehaviorSubject} from "rxjs";

/**
 * Generated class for the DownloadManagerPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-download-manager',
  templateUrl: 'download-manager.html',
})
export class DownloadManagerPage implements DownloadManagerPageInterface, OnInit {
  headerObservable: any;

  storageInfo: AppStorageInfo;
  downloadedContents: Content[] = [];
  defaultImg = 'assets/imgs/ic_launcher.png';
  loader?: Loading;
  deleteAllConfirm: Popover;
  appName: string;
  sortCriteria: ContentSortCriteria[];

  private deletedContentListTitle$?: BehaviorSubject<string>;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private ngZone: NgZone,
    private popoverCtrl: PopoverController,
    private commonUtilService: CommonUtilService,
    private headerServie: AppHeaderService,
    private events: Events,
    private appGlobalService: AppGlobalService,
    private appVersion: AppVersion,
    private telemetryGeneratorService: TelemetryGeneratorService,
    @Inject('CONTENT_SERVICE') private contentService: ContentService,
    @Inject('DEVICE_INFO') private deviceInfo: DeviceInfo,
    @Inject('STORAGE_SERVICE') private storageService: StorageService
  ) {
  }

  async ngOnInit() {
    this.subscribeContentUpdateEvents();
    return Promise.all(
      [this.getDownloadedContents(true),
      this.getAppName()]
      );
  }

  ionViewWillEnter() {
    this.events.subscribe('update_header', () => {
      this.headerServie.showHeaderWithHomeButton(['download', 'settings']);
    });
    this.headerObservable = this.headerServie.headerEventEmitted$.subscribe(eventName => {
      this.handleHeaderEvents(eventName);
    });

    this.headerServie.showHeaderWithHomeButton(['download', 'settings']);
    this.getAppStorageInfo();
    this.getDownloadedContents();
  }

  private async getAppName() {
    return this.appVersion.getAppName()
      .then((appName: any) => {
        this.appName = appName;
      });
  }


  private async getAppStorageInfo(): Promise<AppStorageInfo> {
    const req: ContentSpaceUsageSummaryRequest = {paths: [this.storageService.getStorageDestinationDirectoryPath()]};
    return this.contentService.getContentSpaceUsageSummary(req).toPromise()
      .then((res: ContentSpaceUsageSummaryResponse[]) => {
       return  this.deviceInfo.getAvailableInternalMemorySize().toPromise()
          .then((size) => {
            this.storageInfo = {
              usedSpace: res[0].sizeOnDevice,
              availableSpace: parseInt(size, 10)
            };
            return this.storageInfo;
          });
      });

  }

  async getDownloadedContents(shouldGenerateTelemetry?, hideLoaderFlag?: boolean) {
    const profile: Profile = await this.appGlobalService.getCurrentUser();

    if (!hideLoaderFlag) {
      this.loader = this.commonUtilService.getLoader();
      this.loader.present();
      this.loader.onDidDismiss(() => {
        this.loader = undefined;
      });
    }
    const defaultSortCriteria: ContentSortCriteria[] = [{
      sortAttribute: 'sizeOnDevice',
      sortOrder: SortOrder.DESC
    }];
    const requestParams: ContentRequest = {
      uid: profile.uid,
      contentTypes: ContentType.FOR_DOWNLOADED_TAB,
      audience: [],
      sortCriteria: this.sortCriteria || defaultSortCriteria
    };
    if (shouldGenerateTelemetry) {
      await this.getAppStorageInfo();
    }
    await this.contentService.getContents(requestParams).toPromise()
      .then(data => {
        if (shouldGenerateTelemetry) {
          this.generateInteractTelemetry(data.length, this.storageInfo.usedSpace, this.storageInfo.availableSpace);
        }
        data.forEach((value) => {
          value.contentData['lastUpdatedOn'] = value.lastUpdatedTime;
          if (value.contentData.appIcon) {
            if (value.contentData.appIcon.startsWith('http:') || value.contentData.appIcon.startsWith('https:')) {
              if (this.commonUtilService.networkInfo.isNetworkAvailable) {
                value.contentData.appIcon = value.contentData.appIcon;
              } else {
                value.contentData.appIcon = this.defaultImg;
              }
            } else if (value.basePath) {
              value.contentData.appIcon = value.basePath + '/' + value.contentData.appIcon;
            }
          }
        });
        this.ngZone.run(() => {
          this.downloadedContents = data;
          if (!hideLoaderFlag) {
            this.loader.dismiss();
          }
        });
      })
      .catch((e) => {
        this.ngZone.run(() => {
          if (!hideLoaderFlag) {
            this.loader.dismiss();
          }
        });
      });
  }

  private generateInteractTelemetry(contentCount: number, usedSpace: number, availableSpace: number) {
    const valuesMap = {};
    valuesMap['count'] = contentCount;
    valuesMap['spaceTakenByApp'] = this.commonUtilService.fileSizeInMB(usedSpace);
    valuesMap['freeSpace'] = this.commonUtilService.fileSizeInMB(availableSpace);
    this.telemetryGeneratorService.generateExtraInfoTelemetry(valuesMap, PageId.DOWNLOADS);
  }

  deleteContents(emitedContents: EmitedContents) {
    const contentDeleteRequest: ContentDeleteRequest = {
      contentDeleteList: emitedContents.selectedContents
    };
    if (emitedContents.selectedContents.length > 1) {
      this.deleteAllContents(emitedContents);
    } else {
      this.loader = this.commonUtilService.getLoader();
      this.loader.present();
      this.loader.onDidDismiss(() => {
        this.loader = undefined;
      });

      this.contentService.deleteContent(contentDeleteRequest).toPromise()
        .then((data: ContentDeleteResponse[]) => {
          this.loader.dismiss();
          // this.getDownloadedContents();
          if (data && data[0].status === ContentDeleteStatus.NOT_FOUND) {
            this.commonUtilService.showToast(this.commonUtilService.translateMessage('CONTENT_DELETE_FAILED'));
          } else {
            this.events.publish('savedResources:update', {
              update: true
            });
            this.commonUtilService.showToast(this.commonUtilService.translateMessage('MSG_RESOURCE_DELETED'));
            // this.getAppStorageInfo();
          }
        }).catch((error: any) => {
          this.loader.dismiss();
          this.commonUtilService.showToast(this.commonUtilService.translateMessage('CONTENT_DELETE_FAILED'));
        });
    }
  }

  private deleteAllContents(emitedContents) {
    const valuesMap = {};
    valuesMap['size'] = this.commonUtilService.fileSizeInMB(emitedContents.selectedContentsInfo.totalSize);
    valuesMap['count'] = emitedContents.selectedContentsInfo.count;
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.DELETE_CLICKED,
      Environment.DOWNLOADS,
      PageId.BULK_DELETE_CONFIRMATION_POPUP, undefined, valuesMap);
    const contentDeleteRequest: ContentDeleteRequest = {
      contentDeleteList: emitedContents.selectedContents
    };
    this.deletedContentListTitle$ = new BehaviorSubject('0/' + contentDeleteRequest.contentDeleteList.length);
    this.deleteAllConfirm = this.popoverCtrl.create(SbPopoverComponent, {
      sbPopoverHeading: this.commonUtilService.translateMessage('DELETE_PROGRESS'),
      actionsButtons: [
        {
          btntext: this.commonUtilService.translateMessage('CANCEL'),
          btnClass: 'sb-btn sb-btn-sm  sb-btn-outline-info cancel-delete'
        },
      ],
      icon: null,
      metaInfo: this.commonUtilService.translateMessage('FILES_DELETED'),
      sbPopoverDynamicMainTitle: this.deletedContentListTitle$
      // sbPopoverContent: this.commonUtilService.translateMessage('FILES_DELETED')
    }, {
        cssClass: 'sb-popover danger sb-popover-cancel-delete',
      });
    this.deleteAllConfirm.present();
    this.deleteAllConfirm.onDidDismiss((cancel: any) => {
      if (cancel) {
        this.contentService.clearContentDeleteQueue().toPromise();
      }
    });
    this.contentService.enqueueContentDelete(contentDeleteRequest).toPromise();
    this.contentService.getContentDeleteQueue().skip(1).takeWhile((list) => !!list.length)
      .finally(() => {
        this.deletedContentListTitle$
          .next(`${contentDeleteRequest.contentDeleteList.length}/${contentDeleteRequest.contentDeleteList.length}`);

        this.deleteAllConfirm.dismiss();

        // this.getAppStorageInfo();

        this.events.publish('savedResources:update', {
          update: true
        });
      })
      .subscribe((list) => {
        this.deletedContentListTitle$
          .next(`${contentDeleteRequest.contentDeleteList.length - list.length}/${contentDeleteRequest.contentDeleteList.length}`);
      });
  }


  onSortCriteriaChange(sortAttribute): void {
    let sortAttr: string;
    if (sortAttribute.content === 'Content size') {
      sortAttr = 'sizeOnDevice';
    } else if (sortAttribute.content === 'Last viewed') {
      sortAttr = 'lastUsedOn';
    }
    const valuesMap = {};
    valuesMap['selectedOption'] = sortAttr;
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.SORT_OPTION_SELECTED,
      Environment.DOWNLOADS,
      PageId.DOWNLOADS);
    this.sortCriteria = [{
      sortOrder: SortOrder.DESC,
      sortAttribute: sortAttr
    }];
    this.getDownloadedContents();
  }

  ionViewWillLeave(): void {
    this.events.unsubscribe('update_header');
    this.headerObservable.unsubscribe();
    // this.events.unsubscribe('savedResources:update');
  }

  private subscribeContentUpdateEvents() {
    this.events.subscribe('savedResources:update', (res) => {
      if (res && res.update) {
        this.getDownloadedContents(false, true);
        this.getAppStorageInfo();
      }
    });
  }

  private handleHeaderEvents($event) {
    console.log('inside handleHeaderEvents', $event);
    switch ($event.name) {
      case 'download':
        this.redirectToActivedownloads();
        break;
      case 'settings':
        this.redirectToSettings();
        break;
    }
  }

  private redirectToActivedownloads() {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.ACTIVE_DOWNLOADS_CLICKED,
      Environment.DOWNLOADS,
      PageId.DOWNLOADS);
    this.navCtrl.push(ActiveDownloadsPage);
  }
  private redirectToSettings() {
    this.navCtrl.push(StorageSettingsPage);
  }

}
