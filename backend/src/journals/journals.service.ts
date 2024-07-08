import { Injectable } from '@nestjs/common';
import { Excrements } from 'src/excrements/excrements.entity';
import { DeleteResult, EntityManager, FindOptionsWhere, In, InsertResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Transactional } from 'typeorm-transactional';

import { Journals } from './journals.entity';
import { JournalsRepository } from './journals.repository';
import { CreateExcrementsInfo, CreateJournalData, CreateJournalInfo } from './types/create-journal-data.type';
import {
    DogInfoForDetail,
    ExcrementsCount,
    ExcrementsInfoForDetail,
    JournalDetail,
    JournalInfoForDetail,
} from './types/journal-detail.type';

import { JournalInfoForList } from './types/journal-info.type';
import { UpdateJournalData, UpdateTodayWalkTimeOperation } from './types/update-journal-data.type';

import { DogWalkDayService } from '../dog-walk-day/dog-walk-day.service';
import { DogsService } from '../dogs/dogs.service';
import { ExcrementsService } from '../excrements/excrements.service';
import { EXCREMENT, Excrement } from '../excrements/types/excrement.type';
import { JournalPhotosService } from '../journal-photos/journal-photos.service';
import { JournalsDogs } from '../journals-dogs/journals-dogs.entity';
import { JournalsDogsService } from '../journals-dogs/journals-dogs.service';
import { S3Service } from '../s3/s3.service';
import { TodayWalkTimeService } from '../today-walk-time/today-walk-time.service';
import { formatDate, getStartAndEndOfDay } from '../utils/date.util';
import { checkIfExistsInArr, makeSubObject, makeSubObjectsArray } from '../utils/manipulate.util';

@Injectable()
export class JournalsService {
    constructor(
        private readonly journalsRepository: JournalsRepository,
        private readonly journalsDogsService: JournalsDogsService,
        private readonly dogsService: DogsService,
        private readonly journalPhotosService: JournalPhotosService,
        private readonly excrementsService: ExcrementsService,
        private readonly dogWalkDayService: DogWalkDayService,
        private readonly todayWalkTimeService: TodayWalkTimeService,
        private readonly entityManager: EntityManager,
        private readonly s3Service: S3Service,
    ) {}

    private async create(entityData: Partial<Journals>): Promise<Journals> {
        const journals = new Journals(entityData);
        return this.journalsRepository.create(journals);
    }

    private async delete(journalId: number): Promise<DeleteResult> {
        const where: FindOptionsWhere<Journals> = { id: journalId };
        return this.journalsRepository.delete(where);
    }

    private async updateAndFindOne(
        where: FindOptionsWhere<Journals>,
        partialEntity: QueryDeepPartialEntity<Journals>,
    ): Promise<Journals | null> {
        return this.journalsRepository.updateAndFindOne(where, partialEntity);
    }

    private async getOwnJournalIds(userId: number): Promise<number[]> {
        const ownJournals = await this.journalsRepository.find({ where: { userId }, select: ['id'] });

        return ownJournals.map((cur) => cur.id);
    }

    async checkJournalOwnership(userId: number, journalIds: number | number[]): Promise<[boolean, number[]]> {
        const myJournalIds = await this.getOwnJournalIds(userId);
        return checkIfExistsInArr(myJournalIds, journalIds);
    }

    private makeJournalInfoForDetail(journalId: number, journalInfoRaw: Partial<Journals>, photoUrls: string[]) {
        const journalInfo = makeSubObject(journalInfoRaw, JournalInfoForDetail.getKeysForJournalTable());

        journalInfo.id = journalId;
        journalInfo.routes = JSON.parse(journalInfo.routes);
        journalInfo.photoUrls = photoUrls;

        return journalInfo;
    }

    async getJournalInfoForDetail(journalId: number): Promise<JournalInfoForDetail> {
        const journalInfoRawPromise = this.journalsRepository.findOne({
            where: { id: journalId },
            select: JournalInfoForDetail.getKeysForJournalTable(),
        });

        const [journalInfoRaw, photoUrls]: [Partial<Journals>, string[]] = await Promise.all([
            journalInfoRawPromise,
            this.journalPhotosService.getPhotoUrlsByJournalId(journalId),
        ]);

        return this.makeJournalInfoForDetail(journalId, journalInfoRaw, photoUrls);
    }

    private makeExcrementsInfoForDetail(dogIds: number[], excrementsCount: any[]): ExcrementsInfoForDetail[] {
        const excrementsInfoArray: ExcrementsInfoForDetail[] = [];

        for (let i = 0; i < dogIds.length; i++) {
            const excrementsInfo = new ExcrementsInfoForDetail();

            excrementsInfo.dogId = dogIds[i];
            for (let j = 0; j < excrementsCount.length; j++) {
                if (excrementsCount[j].dogId === dogIds[i]) {
                    excrementsCount[j].type === 'FECES'
                        ? (excrementsInfo.fecesCnt = parseInt(excrementsCount[j].count))
                        : (excrementsInfo.urineCnt = parseInt(excrementsCount[j].count));
                }
            }
            excrementsInfoArray.push(excrementsInfo);
        }
        return excrementsInfoArray;
    }

    async getDogsInfoForDetail(dogIds: number[]): Promise<DogInfoForDetail[]> {
        const dogInfoRaw = await this.dogsService.find({
            where: { id: In(dogIds) },
            select: DogInfoForDetail.getKeysForDogTable(),
        });
        return makeSubObjectsArray(dogInfoRaw, DogInfoForDetail.getKeysForDogTable());
    }

    async getExcrementsInfoForDetail(journalId: number, journalDogIds: number[]) {
        const excrementsCountRaw: ExcrementsCount[] = await this.excrementsService.getExcrementsCount(
            journalId,
            journalDogIds,
        );
        return this.makeExcrementsInfoForDetail(journalDogIds, excrementsCountRaw);
    }

    async getJournalDetail(journalId: number): Promise<JournalDetail> {
        const journalDogIds: number[] = await this.journalsDogsService.getDogIdsByJournalId(journalId);

        const [journalInfo, dogInfo, excrementsInfo]: [
            JournalInfoForDetail,
            DogInfoForDetail[],
            ExcrementsInfoForDetail[],
        ] = await Promise.all([
            this.getJournalInfoForDetail(journalId),
            this.getDogsInfoForDetail(journalDogIds),
            this.getExcrementsInfoForDetail(journalId, journalDogIds),
        ]);

        return new JournalDetail(journalInfo, dogInfo, excrementsInfo);
    }

    private makeJournalData(userId: number, createJournalInfo: CreateJournalInfo): Partial<Journals> {
        const journalData = {
            ...makeSubObject(createJournalInfo, CreateJournalInfo.getKeysForJournalTable()),
            userId,
        };
        if (!journalData.memo) {
            journalData.memo = '';
        }
        journalData.routes = JSON.stringify(journalData.routes);
        return journalData;
    }

    private async updateDogWalkDay(dogIds: number[], operation: (current: number) => number) {
        const dogWalkDayIds = await this.dogsService.getRelatedTableIdList(dogIds, 'walkDayId');
        await this.dogWalkDayService.updateDailyWalkCount(dogWalkDayIds, operation);
    }

    private async updateTodayWalkTime(dogIds: number[], duration: number, operation: UpdateTodayWalkTimeOperation) {
        const todayWalkTimeIds = await this.dogsService.getRelatedTableIdList(dogIds, 'todayWalkTimeId');
        this.todayWalkTimeService.updateDurations(todayWalkTimeIds, duration, operation);
    }

    async createExcrements(journalId: number, excrements: CreateExcrementsInfo[]): Promise<InsertResult> {
        const excrementsEntity: Partial<Excrements>[] = [];

        for (const curExcrements of excrements) {
            const { dogId, fecesLocations, urineLocations } = curExcrements;

            const createExcrementEntity = (
                journalId: number,
                dogId: number,
                type: Excrement,
                coordinate: { lat: string; lng: string },
            ) => ({
                journalId,
                dogId,
                type,
                coordinate: this.excrementsService.makeCoordinate(coordinate.lat, coordinate.lng),
            });

            excrementsEntity.push(
                ...fecesLocations.map((coordinate) =>
                    createExcrementEntity(journalId, dogId, EXCREMENT.Feces, coordinate),
                ),
                ...urineLocations.map((coordinate) =>
                    createExcrementEntity(journalId, dogId, EXCREMENT.Urine, coordinate),
                ),
            );
        }

        return this.excrementsService.insert(excrementsEntity);
    }

    @Transactional()
    async createJournal(userId: number, createJournalData: CreateJournalData) {
        const dogIds = createJournalData.dogs;
        const photoUrls = createJournalData.journalInfo.photoUrls ? createJournalData.journalInfo.photoUrls : [];
        const journalData = this.makeJournalData(userId, createJournalData.journalInfo);
        const createJournalResult = await this.create(journalData);

        await this.journalsDogsService.createJournalDogs(createJournalResult.id, dogIds);
        await this.journalPhotosService.createNewPhotoUrls(createJournalResult.id, photoUrls);

        const addDogWalkDay = (current: number) => (current += 1);
        const addTodayWalkTime = (current: number, value: number) => current + value;
        await this.updateDogWalkDay(dogIds, addDogWalkDay);
        await this.updateTodayWalkTime(dogIds, createJournalData.journalInfo.duration, addTodayWalkTime);

        if (createJournalData.excrements && createJournalData.excrements.length) {
            await this.createExcrements(createJournalResult.id, createJournalData.excrements);
        }
    }

    @Transactional()
    async updateJournal(journalId: number, updateJournalData: UpdateJournalData) {
        if (updateJournalData.memo) {
            await this.updateAndFindOne({ id: journalId }, { memo: updateJournalData.memo });
        }

        if (updateJournalData.photoUrls) {
            const journalPhotos = await this.journalPhotosService.find({ where: { journalId } });
            if (journalPhotos.length) {
                await this.journalPhotosService.delete({ journalId });
            }
            if (updateJournalData.photoUrls.length) {
                await this.journalPhotosService.createNewPhotoUrls(journalId, updateJournalData.photoUrls);
            }
        }
    }

    async deleteJournal(userId: number, journalId: number) {
        const photoUrls: string[] = await this.journalPhotosService.getPhotoUrlsByJournalId(journalId);
        const dogIds: number[] = await this.journalsDogsService.getDogIdsByJournalId(journalId);
        const journalInfo = await this.journalsRepository.findOne({ where: { id: journalId } });

        //TODO: promise-all로 병렬 처리하기
        const subtractTodayWalkTime = (current: number, value: number) => current - value;
        const subtractDogWalkDay = (current: number) => (current -= 1);
        await this.updateDogWalkDay(dogIds, subtractDogWalkDay);
        await this.updateTodayWalkTime(dogIds, journalInfo.duration, subtractTodayWalkTime);

        await this.s3Service.deleteObjects(userId, photoUrls);
        await this.delete(journalId);
    }

    //TODO: join을 하지 않고 테이블을 따로 select해서 코드로 계산하는게 더 빠른지 지금처럽 builder로 join 하는 게 나은지
    private async findJournals(userId: number, dogId: number, startDate: Date, endDate: Date): Promise<Journals[]> {
        return this.entityManager
            .createQueryBuilder(Journals, 'journals')
            .innerJoin(JournalsDogs, 'journals_dogs', 'journals.id = journals_dogs.journal_id')
            .where('journals.user_id = :userId', { userId })
            .andWhere('journals_dogs.dog_id = :dogId', { dogId })
            .andWhere('journals.started_at >= :startDate', { startDate })
            .andWhere('journals.started_at < :endDate', { endDate })
            .getMany();
    }

    //TODO: reduce 하나에서 모두 계산
    //TODO: async, Promise 없애기
    private async getTotal(
        journals: Journals[],
    ): Promise<{ totalWalkCnt: number; totalDistance: number; totalTime: number }> {
        const totalDistance = journals.reduce((acc, journal) => acc + journal.distance, 0);
        const totalTime = journals.reduce((acc, journal) => acc + journal.duration, 0);
        return { totalWalkCnt: journals.length, totalDistance, totalTime };
    }

    async findJournalsAndGetTotal(
        userId: number,
        dogId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<{ [date: string]: number }> {
        const dogJournals = await this.findJournals(userId, dogId, startDate, endDate);
        return this.getTotal(dogJournals);
    }

    //TODO: async 제외하기
    async aggregateJournalsByDay(
        journals: Journals[],
        startDate: Date,
        endDate: Date,
    ): Promise<{ [date: string]: number }> {
        const journalCntAMonth: { [date: string]: number } = {};

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateString = formatDate(currentDate);
            journalCntAMonth[dateString] = 0;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        journals.forEach((journal) => {
            const journalDate = new Date(journal.startedAt);
            const dateString = formatDate(journalDate);
            journalCntAMonth[dateString]++;
        });

        return journalCntAMonth;
    }

    async findJournalsAndAggregateByDay(
        userId: number,
        dogId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<{ [date: string]: number }> {
        const dogJournals = await this.findJournals(userId, dogId, startDate, endDate);
        return this.aggregateJournalsByDay(dogJournals, startDate, endDate);
    }

    //TODO: 코드로 바꿨을 때 성능 향상 되는지 확인해보기
    private async getJournalIdsByDogIdAndDate(dogId: number, date: string): Promise<number[]> {
        const startEndDate = getStartAndEndOfDay(new Date(date));
        const result = await this.entityManager
            .createQueryBuilder(Journals, 'journals')
            .select('journals.id')
            .orderBy('journals.id', 'ASC')
            .innerJoin(JournalsDogs, 'journals_dogs', 'journals.id = journals_dogs.journal_id')
            .where('journals_dogs.dog_id = :dogId', { dogId })
            .andWhere('journals.started_at >= :startDate', { startDate: startEndDate.startDate })
            .andWhere('journals.started_at < :endDate', { endDate: startEndDate.endDate })
            .getRawMany();

        //TODO: select 적용해서 map 없애기
        return result.map((cur) => cur.journals_id);
    }

    private putDogCntToJournalList(journalInfos: JournalInfoForList[], firstJournalCnt: number): JournalInfoForList[] {
        return journalInfos.map((cur) => {
            const newJournal: JournalInfoForList = {
                ...cur,
                journalCnt: firstJournalCnt++,
            };
            return newJournal;
        });
    }

    async getJournalList(dogId: number, date: string): Promise<JournalInfoForList[]> {
        const journalIds = await this.getJournalIdsByDogIdAndDate(dogId, date);
        if (!journalIds.length) {
            return [];
        }

        //TODO: Promise all 적용하기
        const journalInfosRaw = await this.journalsRepository.find({
            where: { id: In(journalIds) },
            select: JournalInfoForList.getKeysForJournalTable(),
        });

        const journalInfos = await makeSubObjectsArray(
            journalInfosRaw,
            JournalInfoForList.getAttributesForJournalTable(),
            JournalInfoForList.getKeysForJournalTable(),
        );
        const findResult = await this.journalsDogsService.find({ where: { dogId }, select: ['journalId'] });
        //TODO: jd -> journal Data 변수명 수정, 로직 개선
        const journalCntForFirstRow = findResult.findIndex((jd) => jd.journalId === journalInfos[0].journalId);
        const result = this.putDogCntToJournalList(journalInfos, journalCntForFirstRow + 1);
        return result;
    }
}
