import { httpClient } from '@/api/http';
import { WalkAvailableDog, Dog, DogCreateForm, DogStatistic } from '@/models/dog';
export type period = 'week' | 'month';
export const fetchDogStatistic = async (): Promise<DogStatistic[]> => {
    const { data } = await httpClient.get('/dogs/statistics');
    return data;
};

export const fetchWalkAvailableDogs = async (): Promise<WalkAvailableDog[]> => {
    const { data } = await httpClient.get('/dogs/walks/available');
    return data;
};

export const createDog = async (params: DogCreateForm) => {
    const { data } = await httpClient.post('/dogs', params);
    return data;
};

export const fetchDogMonthStatistic = async (dogId: number, date: string, period: period) => {
    const { data } = await httpClient.get(`/dogs/${dogId}/statistics?date=${date}&period=${period}`);
    return data;
};

export const fetchDogs = async (): Promise<Dog[]> => {
    const { data } = await httpClient.get<Dog[]>('/dogs');
    return data;
};

export const deleteDog = async (dogId: number) => {
    await httpClient.delete(`/dogs/${dogId}`);
};

export interface RecentMonthStatisticsResponse {
    totalWalkCnt: number;
    totalDistance: number;
    totalTime: number;
}
export const fetchDogRecentMonthStatistics = async (dogId: number): Promise<RecentMonthStatisticsResponse> => {
    const { data } = await httpClient.get<RecentMonthStatisticsResponse>(
        `/dogs/${dogId}/statistics/recent?period=month`
    );
    return data;
};

export const updateDog = async ({ dogId, params }: { dogId: number; params: DogCreateForm }) => {
    await httpClient.patch(`/dogs/${dogId}`, params);
};
