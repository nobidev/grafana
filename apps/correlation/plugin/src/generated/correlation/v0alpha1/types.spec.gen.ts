// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	source_uid: string;
	target_uid: string;
	label: string;
	description: string;
	config: string;
	provisioned: number;
	type: string;
}

export const defaultSpec = (): Spec => ({
	source_uid: "",
	target_uid: "",
	label: "",
	description: "",
	config: "",
	provisioned: 0,
	type: "",
});

