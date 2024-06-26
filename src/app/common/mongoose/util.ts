import { Model } from 'mongoose';

export type ObtainModelGeneric<
	M,
	alias extends
		| 'TRawDocType'
		| 'TQueryHelpers'
		| 'TInstanceMethods'
		| 'TVirtuals'
		| 'THydratedDocumentType'
> = M extends Model<
	infer TRawDocType,
	infer TQueryHelpers,
	infer TInstanceMethods,
	infer TVirtuals,
	infer THydratedDocumentType
>
	? {
			TRawDocType: TRawDocType;
			TQueryHelpers: TQueryHelpers;
			TInstanceMethods: TInstanceMethods;
			TVirtuals: TVirtuals;
			THydratedDocumentType: THydratedDocumentType;
	  }[alias]
	: unknown;
