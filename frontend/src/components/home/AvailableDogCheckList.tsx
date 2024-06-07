import AllDogs from '@/assets/icons/ic-default-dog.svg';
import Avatar from '@/components/commons/Avatar';
import { Checkbox } from '@/components/commons/Checkbox';
import { AvailableDogCheck } from '@/components/home/AvailableDogCheck';
import { WalkAvailableDog } from '@/models/dog';

interface AvailableDogCheckListProps {
    dogs: WalkAvailableDog[] | undefined;
    onToggle: (id: number) => void;
    checkAll: (flag: boolean) => void;
    isCheckedAll: boolean;
}
export default function AvailableDogCheckList({ dogs, onToggle, checkAll, isCheckedAll }: AvailableDogCheckListProps) {
    return (
        <>
            <li className="flex items-center justify-between py-3">
                <Avatar url={AllDogs} name={'다 함께'} />
                <Checkbox
                    checked={isCheckedAll}
                    onCheckedChange={() => {
                        checkAll(!isCheckedAll);
                    }}
                ></Checkbox>
            </li>
            {dogs?.map((dog) => <AvailableDogCheck dog={dog} key={dog.id} onToggle={onToggle} />)}
        </>
    );
}
