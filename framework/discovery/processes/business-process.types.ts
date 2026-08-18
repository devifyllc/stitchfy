/**
 * TODO: no extraction agent yet — populated manually or by a future
 * discovery agent once process-mapping input format is defined.
 */
export interface BusinessProcess {
  id: string;
  name: string;
  description: string;
  actors: string[];
  steps: string[];
  painPoints: string[];
}
