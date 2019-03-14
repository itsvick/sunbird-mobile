import {CommonUtilService} from './../../service/common-util.service';
import {Component, Inject, NgZone, ViewChild} from '@angular/core';
import {
  AlertController,
  Events,
  IonicPage,
  Navbar,
  NavController,
  NavParams,
  Platform,
  PopoverController
} from 'ionic-angular';
import {
  ContentService,
  CorrelationData,
  Environment,
  FileUtil,
  ImpressionType,
  InteractSubtype,
  InteractType,
  MarkerType,
  PageId,
  SharedPreferences,
  TabsPage
} from 'sunbird';
import {ContentDetailsPage} from '../content-details/content-details';
import {EnrolledCourseDetailsPage} from '../enrolled-course-details/enrolled-course-details';
import {ContentType, MimeType} from '../../app/app.constant';
import {CollectionDetailsPage} from '../collection-details/collection-details';
import {TranslateService} from '@ngx-translate/core';
import {AppGlobalService} from '../../service/app-global.service';
import {TelemetryGeneratorService} from '../../service/telemetry-generator.service';
import * as _ from 'lodash';
import {ProfileSettingsPage} from '../profile-settings/profile-settings';
import {
  ChildContentRequest,
  Content,
  ContentMarkerRequest,
  ContentService as NewContentService,
  Framework,
  FrameworkCategoryCodesGroup,
  FrameworkDetailsRequest,
  FrameworkService,
  FrameworkUtilService,
  GetAllProfileRequest,
  GetSuggestedFrameworksRequest,
  Profile,
  ProfileService,
} from 'sunbird-sdk';

@IonicPage()
@Component({
  selector: 'page-qr-code-result',
  templateUrl: 'qr-code-result.html'
})
export class QrCodeResultPage {
  unregisterBackButton: any;
  /**
   * To hold identifier
   */
  identifier: string;

  /**
   * To hold identifier
   */
  searchIdentifier: string;

  /**
   * Show loader while importing content
   */
  showChildrenLoader: boolean;

  /**
   * Contains card data of previous state
   */
  content: Content;

  /**
   * Contains Parent Content Details
   */
  parentContent: any;

  /**
   * Contains
   */
  isParentContentAvailable = false;
  profile: Profile;

  corRelationList: Array<CorrelationData>;
  shouldGenerateEndTelemetry = false;
  source = '';
  results: Array<any> = [];
  defaultImg: string;
  parents: Array<any> = [];
  paths: Array<any> = [];
  categories: Array<any> = [];
  boardList: Array<any> = [];
  mediumList: Array<any> = [];
  gradeList: Array<any> = [];
  isSingleContent = false;
  showLoading: Boolean;
  isDownloadStarted: Boolean;
  userCount = 0;
  /**
   * To hold previous state data
   */
  cardData: any;
  @ViewChild(Navbar) navBar: Navbar;
  downloadProgress: any = 0;
  isUpdateAvailable: boolean;

  constructor(
    @Inject('CONTENT_SERVICE') private newContentService: NewContentService,
    @Inject('PROFILE_SERVICE') private profileService: ProfileService,
    public navCtrl: NavController,
    public navParams: NavParams,
    public contentService: ContentService,
    public zone: NgZone,
    public translate: TranslateService,
    public platform: Platform,
    private telemetryGeneratorService: TelemetryGeneratorService,
    private alertCtrl: AlertController,
    private appGlobalService: AppGlobalService,
    private events: Events,
    private preferences: SharedPreferences,
    private popOverCtrl: PopoverController,
    private commonUtilService: CommonUtilService,
    private fileUtil: FileUtil,
    @Inject('FRAMEWORK_SERVICE') private frameworkService: FrameworkService,
    @Inject('FRAMEWORK_UTIL_SERVICE') private frameworkUtilService: FrameworkUtilService
  ) {
    this.defaultImg = 'assets/imgs/ic_launcher.png';
  }

  /**
   * Ionic life cycle hook
   */
  ionViewWillEnter(): void {
    this.content = this.navParams.get('content');
    this.corRelationList = this.navParams.get('corRelation');
    this.shouldGenerateEndTelemetry = this.navParams.get('shouldGenerateEndTelemetry');
    this.source = this.navParams.get('source');
    this.isSingleContent = this.navParams.get('isSingleContent');

    // check for parent content
    this.parentContent = this.navParams.get('parentContent');
    this.searchIdentifier = this.content.identifier;

    if (this.parentContent) {
      this.isParentContentAvailable = true;
      this.identifier = this.parentContent.identifier;
    } else {
      this.isParentContentAvailable = false;
      this.identifier = this.content.identifier;
    }
    this.setContentDetails(this.identifier, true);
    this.getChildContents();
    this.unregisterBackButton = this.platform.registerBackButtonAction(() => {
      this.handleBackButton(InteractSubtype.DEVICE_BACK_CLICKED);
    }, 10);
    this.subscribeGenieEvent();
  }

  ionViewDidLoad() {
    this.telemetryGeneratorService.generateImpressionTelemetry(ImpressionType.VIEW, '',
      PageId.DIAL_CODE_SCAN_RESULT,
      !this.appGlobalService.isOnBoardingCompleted ? Environment.ONBOARDING : Environment.HOME);

    this.navBar.backButtonClick = () => {
      this.handleBackButton(InteractSubtype.NAV_BACK_CLICKED);
    };
    if (!AppGlobalService.isPlayerLaunched) {
      this.calculateAvailableUserCount();
    }
  }

  ionViewWillLeave() {
    // Unregister the custom back button action for this page
    if (this.unregisterBackButton) {
      this.unregisterBackButton();
    }
    this.downloadProgress = 0;
    this.events.unsubscribe('genie.event');
  }

  handleBackButton(clickSource) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      clickSource,
      !this.appGlobalService.isOnBoardingCompleted ? Environment.ONBOARDING : Environment.HOME,
      PageId.DIAL_CODE_SCAN_RESULT);
    if (this.source === PageId.LIBRARY || this.source === PageId.COURSES || !this.isSingleContent) {
      this.navCtrl.pop();
    } else if (this.isSingleContent && this.appGlobalService.isProfileSettingsCompleted) {
      this.navCtrl.setRoot(TabsPage, {
        loginMode: 'guest'
      });
    } else if (this.appGlobalService.isGuestUser && this.isSingleContent && !this.appGlobalService.isProfileSettingsCompleted) {
      this.navCtrl.setRoot(ProfileSettingsPage, {
        isCreateNavigationStack: false,
        hideBackButton: true
      });
    } else {
      this.navCtrl.pop();
    }
  }

  getChildContents() {
    const request: ChildContentRequest = {contentId: this.identifier, hierarchyInfo: []};
    this.newContentService.getChildContents(
      request).toPromise()
      .then((data: Content) => {
        this.parents.splice(0, this.parents.length);
        this.parents.push(data);
        this.results = [];
        this.profile = this.appGlobalService.getCurrentUser();
        const contentData = data.contentData;
        this.checkProfileData(contentData, this.profile);
        this.findContentNode(data);

        if (this.results && this.results.length === 0) {
          this.telemetryGeneratorService.generateImpressionTelemetry(ImpressionType.VIEW,
            '',
            PageId.DIAL_LINKED_NO_CONTENT,
            Environment.HOME);
          this.commonUtilService.showContentComingSoonAlert(this.source);
          this.navCtrl.pop();
        }

      })
      .catch(() => {
        this.zone.run(() => {
          this.showChildrenLoader = false;
        });
        this.commonUtilService.showContentComingSoonAlert(this.source);
        this.navCtrl.pop();
      });

  }

  calculateAvailableUserCount() {
    const profileRequest: GetAllProfileRequest = {
      local: true,
      server: false
    };
    this.profileService.getAllProfiles(profileRequest)
      .map((profiles) => profiles.filter((profile) => !!profile.handle))
      .subscribe(profiles => {
      if (profiles) {
        this.userCount = profiles.length;
      }
      if (this.appGlobalService.isUserLoggedIn()) {
        this.userCount += 1;
      }
    }, () => {
    });
  }

  /**
   * Play content
   */
  playContent(content: Content) {
    const extraInfoMap = { hierarchyInfo: [] };
    if (this.cardData && this.cardData.hierarchyInfo) {
      extraInfoMap.hierarchyInfo = this.cardData.hierarchyInfo;
    }
    const req: ContentMarkerRequest = {
      uid: this.appGlobalService.getCurrentUser().uid,
      contentId: content.identifier,
      data: JSON.stringify(content.contentData),
      marker: MarkerType.PREVIEWED,
      isMarked: true,
      extraInfo: extraInfoMap
    };
    this.newContentService.setContentMarker(req).toPromise()
      .then(() => {
      }).catch(() => {
      });
    const request: any = {};
    request.streaming = true;
    AppGlobalService.isPlayerLaunched = true;
    (<any>window).geniecanvas.play(content, JSON.stringify(request));
  }

  playOnline(content) {
    if (content.contentData.streamingUrl && !content.isAvailableLocally) {
      this.playContent(content);
    } else {
      this.navigateToDetailsPage(content);
    }
  }

  navigateToDetailsPage(content) {
    if (content && content.contentData && content.contentData.contentType === ContentType.COURSE) {
      this.navCtrl.push(EnrolledCourseDetailsPage, {
        content: content
      });
    } else if (content && content.mimeType === MimeType.COLLECTION) {
      this.navCtrl.push(CollectionDetailsPage, {
        content: content
      });
    } else {
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.TOUCH,
        Boolean(content.isAvailableLocally) ? InteractSubtype.PLAY_CLICKED : InteractSubtype.DOWNLOAD_PLAY_CLICKED,
        !this.appGlobalService.isOnBoardingCompleted ? Environment.ONBOARDING : Environment.HOME,
        PageId.DIAL_CODE_SCAN_RESULT);
      this.navCtrl.push(ContentDetailsPage, {
        content: content,
        depth: '1',
        isChildContent: true,
        downloadAndPlay: true
      });
    }
  }

  editProfile(): void {
    const req: Profile = {
      board: this.profile.board,
      grade: this.profile.grade,
      medium: this.profile.medium,
      subject: this.profile.subject,
      uid: this.profile.uid,
      handle: this.profile.handle,
      profileType: this.profile.profileType,
      source: this.profile.source,
      createdAt: this.profile.createdAt,
      syllabus: this.profile.syllabus
    };
    if (this.profile.grade && this.profile.grade.length > 0) {
      this.profile.grade.forEach(gradeCode => {
        for (let i = 0; i < this.gradeList.length; i++) {
          if (this.gradeList[i].code === gradeCode) {
            req.gradeValue = this.profile.gradeValue;
            req.gradeValue[this.gradeList[i].code] = this.gradeList[i].name;
            break;
          }
        }
      });
    }

    this.profileService.updateProfile(req).toPromise()
      .then((res: any) => {
        if (res.syllabus && res.syllabus.length && res.board && res.board.length
          && res.grade && res.grade.length && res.medium && res.medium.length) {
          this.events.publish(AppGlobalService.USER_INFO_UPDATED);
          this.events.publish('refresh:profile');
        }
        this.appGlobalService.guestUserProfile = res;
      })
      .catch(() => {
      });
  }

  /** funtion add elipses to the texts**/

  addElipsesInLongText(msg: string) {
    if (this.commonUtilService.translateMessage(msg).length >= 12) {
      return this.commonUtilService.translateMessage(msg).slice(0, 8) + '....';
    } else {
      return this.commonUtilService.translateMessage(msg);
    }
  }

  /**
   * To set content details in local variable
   * @param {string} identifier identifier of content / course
   */
  setContentDetails(identifier, refreshContentDetails: boolean | true) {
    const option = {
      contentId: identifier,
      refreshContentDetails: refreshContentDetails,
      attachFeedback: true,
      attachContentAccess: true
    };
    this.newContentService.getContentDetails(option).toPromise()
      .then((data: any) => {
      })
      .catch((error: any) => {
      });
  }

  private showAllChild(content: Content) {
    this.zone.run(() => {
      if (content.children === undefined) {
        if (content.mimeType !== MimeType.COLLECTION) {
          this.results.push(content);

          const path = [];
          this.parents.forEach(ele => {
            path.push(ele);
          });
          path.splice(-1, 1);
          this.paths.push(path);
        }
        return;
      }
      content.children.forEach(child => {
        this.parents.push(child);
        this.showAllChild(child);
        this.parents.splice(-1, 1);
      });
    });
  }

  setGrade(reset, grades) {
    if (reset) {
      this.profile.grade = [];
      this.profile.gradeValue = {};
    }
    _.each(grades, (grade) => {
      if (grade && this.profile.grade.indexOf(grade) === -1) {
        if (this.profile.grade && this.profile.grade.length) {
          this.profile.grade.push(grade);
        } else {
          this.profile.grade = [grade];
        }
      }
    });
  }

  /**
   * @param categoryList
   * @param data
   * @param categoryType
   * return the code of board,medium and subject based on Name
   */
  findCode(categoryList: Array<any>, data, categoryType) {
    if (_.find(categoryList, (category) => category.name === data[categoryType])) {
      return _.find(categoryList, (category) => category.name === data[categoryType]).code;
    } else {
      return undefined;
    }
  }

  /**
   * Assigning board, medium, grade and subject to profile
   */

  setCurrentProfile(index, data) {
    if (!this.profile.medium || !this.profile.medium.length) {
      this.profile.medium = [];
    }
    /*     if (!this.profile.subject || !this.profile.subject.length) {
          this.profile.subject = [];
        }
     */
    switch (index) {
      case 0:
        this.profile.syllabus = [data.framework];
        this.profile.board = [data.board];
        this.profile.medium = [data.medium];
        // this.profile.subject = [data.subject];
        this.profile.subject = [];
        this.setGrade(true, data.gradeLevel);
        break;
      case 1:
        this.profile.board = [data.board];
        this.profile.medium = [data.medium];
        // this.profile.subject = [data.subject];
        this.profile.subject = [];
        this.setGrade(true, data.gradeLevel);
        break;
      case 2:
        this.profile.medium.push(data.medium);
        break;
      case 3:
        this.setGrade(false, data.gradeLevel);
        break;
      /*       case 4:
              this.profile.subject.push(data.subject);
              break;
       */
    }
    this.editProfile();
  }

  /**
   * comparing current profile data with qr result data, If not matching then reset current profile data
   * @param {object} data
   * @param {object} profile
   */
  checkProfileData(data, profile) {
    if (data && data.framework) {

      const getSuggestedFrameworksRequest: GetSuggestedFrameworksRequest = {
        language: this.translate.currentLang,
        requiredCategories: FrameworkCategoryCodesGroup.DEFAULT_FRAMEWORK_CATEGORIES
      };
      this.frameworkUtilService.getActiveChannelSuggestedFrameworkList(getSuggestedFrameworksRequest).toPromise()
        .then((res: Framework[]) => {
          let isProfileUpdated = false;
          res.forEach(element => {
            // checking whether content data framework Id exists/valid in syllabus list
            if (data.framework === element.identifier) {
              isProfileUpdated = true;
              const frameworkDetailsRequest: FrameworkDetailsRequest = {
                frameworkId: data.framework,
                requiredCategories: FrameworkCategoryCodesGroup.DEFAULT_FRAMEWORK_CATEGORIES
              };
              this.frameworkService.getFrameworkDetails(frameworkDetailsRequest).toPromise()
                .then((framework: Framework) => {
                  console.log('framework', framework);
                  this.categories = framework.categories;
                  this.boardList = _.find(this.categories, (category) => category.code === 'board').terms;
                  this.mediumList = _.find(this.categories, (category) => category.code === 'medium').terms;
                  this.gradeList = _.find(this.categories, (category) => category.code === 'gradeLevel').terms;
                  //                  this.subjectList = _.find(this.categories, (category) => category.code === 'subject').terms;
                  if (data.board) {
                    data.board = this.findCode(this.boardList, data, 'board');
                  }
                  if (data.medium) {
                    data.medium = this.findCode(this.mediumList, data, 'medium');
                  }
                  /*                   if (data.subject) {
                                      data.subject = this.findCode(this.subjectList, data, 'subject');
                                    } */
                  if (data.gradeLevel && data.gradeLevel.length) {
                    data.gradeLevel = _.map(data.gradeLevel, (dataGrade) => {
                      return _.find(this.gradeList, (grade) => grade.name === dataGrade).code;
                    });
                  }
                  if (profile && profile.syllabus && profile.syllabus[0] && data.framework === profile.syllabus[0]) {
                    if (data.board) {
                      if (profile.board && !(profile.board.length > 1) && data.board === profile.board[0]) {
                        if (data.medium) {
                          let existingMedium = false;
                          existingMedium = _.find(profile.medium, (medium) => {
                            return medium === data.medium;
                          });
                          if (!existingMedium) {
                            this.setCurrentProfile(2, data);
                          }
                          if (data.gradeLevel && data.gradeLevel.length) {
                            let existingGrade = false;
                            for (let i = 0; i < data.gradeLevel.length; i++) {
                              const gradeExists = _.find(profile.grade, (grade) => {
                                return grade === data.gradeLevel[i];
                              });
                              if (!gradeExists) {
                                break;
                              }
                              existingGrade = true;
                            }
                            if (!existingGrade) {
                              this.setCurrentProfile(3, data);
                            }
                            /*                             let existingSubject = false;
                                                        existingSubject = _.find(profile.subject, (subject) => {
                                                          return subject === data.subject;
                                                        });
                                                        if (!existingSubject) {
                                                          this.setCurrentProfile(4, data);
                                                        }
                             */
                          }
                        }
                      } else {
                        this.setCurrentProfile(1, data);
                      }
                    }
                  } else {
                    this.setCurrentProfile(0, data);
                  }
                }).catch(() => {
                });

              return;
            }
          });
          this.telemetryGeneratorService.generateProfilePopulatedTelemetry(PageId.DIAL_CODE_SCAN_RESULT,
            data.framework, Boolean(isProfileUpdated) ? 'auto' : 'na');
        })
        .catch(() => {
        });
    }
  }

  /**
   * Subscribe genie event to get content download progress
   */
  subscribeGenieEvent() {
    this.events.subscribe('genie.event', (data) => {
      this.zone.run(() => {
        data = JSON.parse(data);
        const res = data;

        if (res.type === 'downloadProgress' && res.data.downloadProgress) {
          if (res.data.downloadProgress === -1 || res.data.downloadProgress === '-1') {
            this.downloadProgress = 0;
          } else if (res.data.identifier === this.content.identifier) {
            this.downloadProgress = res.data.downloadProgress;
          }

        }
        // Get child content
        if (res.data && res.data.status === 'IMPORT_COMPLETED' && res.type === 'contentImport') {

          this.showLoading = false;
          this.isDownloadStarted = false;
          this.results = [];
          this.parents = [];
          this.paths = [];
          this.getChildContents();
        }
        // For content update available
        if (res.data && res.type === 'contentUpdateAvailable' && res.data.identifier === this.identifier) {
          this.zone.run(() => {
            if (this.parentContent) {
              const parentIdentifier = this.parentContent.contentId || this.parentContent.identifier;
              this.showLoading = true;
              this.importContent([parentIdentifier], false);
            }
          });
        }
      });
    });
  }

  private findContentNode(data: any) {
    if (data && data.identifier === this.searchIdentifier) {
      this.showAllChild(data);
      return true;
    }

    if (data && data.children !== undefined) {
      data.children.forEach(child => {
        this.parents.push(child);
        const isFound = this.findContentNode(child);

        if (isFound === true) {
          return true;
        }
        this.parents.splice(-1, 1);
      });
    }

    return false;
  }

  /**
   * Function to get import content api request params
   *
   * @param {Array<string>} identifiers contains list of content identifier(s)
   * @param {boolean} isChild
   */
  importContent(identifiers: Array<string>, isChild: boolean, isDownloadAllClicked?) {
    const option = {
      contentImportMap: _.extend({}, this.getImportContentRequestBody(identifiers, isChild)),
      contentStatusArray: []
    };

    // Call content service
    this.contentService.importContent(option)
      .then((data: any) => {
        this.zone.run(() => {
          data = JSON.parse(data);
        });
      })
      .catch((error: any) => {
        this.zone.run(() => {
          this.isDownloadStarted = false;
          this.showLoading = false;
          const errorRes = JSON.parse(error);
          if (errorRes && (errorRes.error === 'NETWORK_ERROR' || errorRes.error === 'CONNECTION_ERROR')) {
            this.commonUtilService.showToast('NEED_INTERNET_TO_CHANGE');
          } else {
            this.commonUtilService.showToast('UNABLE_TO_FETCH_CONTENT');
          }
        });
      });
  }

  /**
   * Function to get import content api request params
   *
   * @param {Array<string>} identifiers contains list of content identifier(s)
   * @param {boolean} isChild
   */
  getImportContentRequestBody(identifiers: Array<string>, isChild: boolean) {
    const requestParams = [];
    _.forEach(identifiers, (value) => {
      requestParams.push({
        isChildContent: isChild,
        destinationFolder: this.fileUtil.internalStoragePath(),
        contentId: value,
        correlationData: this.corRelationList !== undefined ? this.corRelationList : []
      });
    });

    return requestParams;
  }

  cancelDownload() {
    this.telemetryGeneratorService.generateCancelDownloadTelemetry(this.content);
    this.contentService.cancelDownload(this.identifier).then(() => {
      this.zone.run(() => {
        this.showLoading = false;
        this.navCtrl.pop();
      });
    }).catch(() => {
      this.zone.run(() => {
        this.showLoading = false;
        this.navCtrl.pop();
      });
    });
  }

  skipSteps() {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.SKIP_CLICKED,
      !this.appGlobalService.isOnBoardingCompleted ? Environment.ONBOARDING : Environment.HOME,
      PageId.DIAL_CODE_SCAN_RESULT
    );
    if ((this.appGlobalService.isOnBoardingCompleted && this.appGlobalService.isProfileSettingsCompleted)
      || !this.appGlobalService.DISPLAY_ONBOARDING_CATEGORY_PAGE) {
      this.navCtrl.setRoot(TabsPage, {
        loginMode: 'guest'
      });
    } else {
      this.navCtrl.setRoot(ProfileSettingsPage);
    }
  }
}
