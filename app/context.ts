import type {Dispatch,SetStateAction} from 'react';
import type {Data,Course,Classroom,Session,Student,Module,FinalGrade,RecordEntry,suggest} from '@/lib/model';
export type Draft={ [key:string]:any;modules:Module[];proposals:{id:string;value:NonNullable<ReturnType<typeof suggest>>}[] };
export type AppContext={
 [key:string]:any;
 data:Data;course:Course;classroom:Classroom|undefined;module:number;moduleInfo:Module;session:Session|undefined;sessions:Session[];allStudents:Student[];students:Student[];
 update:(fn:(d:Data)=>void)=>void;form:Draft;modal:string;target:string;
 record:(id:string)=>RecordEntry;setRecord:(id:string,patch:Partial<RecordEntry>)=>void;
 getFinal:(id:string,m?:number)=>FinalGrade;setFinal:(id:string,patch:Partial<FinalGrade>)=>void;
 setData:Dispatch<SetStateAction<Data|null>>;
};
