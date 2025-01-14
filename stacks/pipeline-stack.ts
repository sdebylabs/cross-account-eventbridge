import {
  aws_codestarconnections as codeStartConnections,
  pipelines,
  Stack,
  StackProps,
  Stage,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

interface PipelineStackProps extends StackProps {
  stages: Stage[]
  accounts: Record<string, string>
}

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props)

    const codeStarConnection = new codeStartConnections.CfnConnection(
      this,
      'CodeStarConnection',
      {
        connectionName: 'GitHubConnection',
        providerType: 'GitHub',
      }
    )

    const cdkContextArgs = Object.entries(props.accounts)
      .map(([key, value]) => `-c ${key}=${value}`)
      .join(' ')

    const REPO = 'sdebylabs/cross-account-eventbridge'
    // const repo = this.node.tryGetContext(`repo`)
    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(REPO, 'main', {
          connectionArn: codeStarConnection.ref,
          triggerOnPush: false, // TODO - set to true when working
        }),
        commands: [
          'npm ci',
          'npm run build',
          `npx cdk ${cdkContextArgs} synth`,
        ],
      }),
    })
    const wave = pipeline.addWave('ApplicationWave')
    for (const stage of props.stages) {
      wave.addStage(stage)
    }
  }
}
