import { TextbookTocService } from '../../pages/collection-details-etb/textbook-toc-service';
import { Component, Input, NgZone, AfterViewInit } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { EnrolledCourseDetailsPage } from '@app/pages/enrolled-course-details';
import { ContentType, MimeType } from '@app/app/app.constant';
import { CollectionDetailsEtbPage } from '@app/pages/collection-details-etb/collection-details-etb';
import { ContentDetailsPage } from '@app/pages/content-details/content-details';
import { CommonUtilService } from '@app/service';
import { PopoverController } from 'ionic-angular';
import { SbGenericPopoverComponent } from '../popups/sb-generic-popup/sb-generic-popover';
import { Content } from 'sunbird-sdk';
import { ComingSoonMessageService } from "@app/service/coming-soon-message.service";


@Component({
    selector: 'collection-child',
    templateUrl: 'collection-child.html'
})
export class CollectionChildComponent implements AfterViewInit {
    cardData: any;
    // isTextbookTocPage: Boolean = false;
    @Input() childData: Content;
    @Input() index: any;
    @Input() depth: any;
    @Input() corRelationList: any;
    @Input() isDepthChild: any;
    @Input() breadCrumb: any;
    @Input() defaultAppIcon: string;
    @Input() localImage: string;
    @Input() activeMimeTypeFilter: any;
    @Input() rootUnitId: any;
    @Input() isTextbookTocPage: Boolean;

    constructor(
        private navCtrl: NavController,
        private zone: NgZone,
        private navParams: NavParams,
        private commonUtilService: CommonUtilService,
        private popoverCtrl: PopoverController,
        private comingSoonMessageService: ComingSoonMessageService,
        private textbookTocService: TextbookTocService
    ) {
        this.cardData = this.navParams.get('content');
    }


    setContentId(id: string) {
        console.log('collection first child', id);
        if (this.navCtrl.getActive().component['pageName'] === 'TextBookTocPage') {
            this.textbookTocService.setTextbookIds({rootUnitId: this.rootUnitId, contentId: id});
            this.navCtrl.pop();
        }
    }

    navigateToDetailsPage(content: Content, depth) {
        if (this.navCtrl.getActive().component['pageName'] === 'TextBookTocPage') {
            console.log('collection last child', depth, content);
            this.textbookTocService.setTextbookIds({rootUnitId: this.rootUnitId, contentId: content.identifier});
            this.navCtrl.pop();
        } else {
            const stateData = this.navParams.get('contentState');

            this.zone.run(() => {
                if (content.contentType === ContentType.COURSE) {
                    this.navCtrl.push(EnrolledCourseDetailsPage, {
                        content: content,
                        depth: depth,
                        contentState: stateData,
                        corRelation: this.corRelationList,
                        breadCrumb: this.breadCrumb
                    });
                } else if (content.mimeType === MimeType.COLLECTION) {
                    this.isDepthChild = true;
                    this.navCtrl.push(CollectionDetailsEtbPage, {
                        content: content,
                        depth: depth,
                        contentState: stateData,
                        corRelation: this.corRelationList,
                        breadCrumb: this.breadCrumb
                    });
                } else {
                    this.navCtrl.push(ContentDetailsPage, {
                        isChildContent: true,
                        content: content,
                        depth: depth,
                        contentState: stateData,
                        corRelation: this.corRelationList,
                        breadCrumb: this.breadCrumb
                    });
                }
            });
        }
    }

    async showComingSoonPopup(childData: any) {
        console.log('in show comingsooon collection child', childData);
        let channelId;
        if (this.cardData) {
            channelId = (this.cardData.contentData && this.cardData.contentData.channel) || this.cardData.channel;
        }
        const message = await this.comingSoonMessageService.getComingSoonMessage(channelId, childData);
        if (childData.contentData.mimeType === 'application/vnd.ekstep.content-collection' && !childData.children) {
            const popover = this.popoverCtrl.create(SbGenericPopoverComponent, {
                sbPopoverHeading: this.commonUtilService.translateMessage('CONTENT_COMMING_SOON'),
                sbPopoverMainTitle: message ? this.commonUtilService.translateMessage(message) :
                    this.commonUtilService.translateMessage('CONTENT_IS_BEEING_ADDED') + childData.contentData.name,
                actionsButtons: [
                    {
                        btntext: this.commonUtilService.translateMessage('OKAY'),
                        btnClass: 'popover-color'
                    }
                ],
            }, {
                    cssClass: 'sb-popover warning',
                });
            popover.present({
                ev: event
            });
        }
    }

    hasMimeType(activeMimeType: string[], mimeType: string, content): boolean {
        if (!activeMimeType) {
            return true;
        } else {
            if (activeMimeType.indexOf('all') > -1) {
                // if (content.contentData.mimeType === MimeType.COLLECTION && !content.children) {
                //     return false;
                // }
                return true;
            }
            return !!activeMimeType.find( m => m === mimeType);
        }
    }

    ngAfterViewInit(): void {
    }
}
