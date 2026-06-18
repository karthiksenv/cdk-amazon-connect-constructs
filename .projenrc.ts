import { awscdk } from 'projen';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Karth',
  authorAddress: 'karth@example.com',
  cdkVersion: '2.260.0',
  defaultReleaseBranch: 'main',
  description: 'L2-style AWS CDK constructs for Amazon Connect.',
  jsiiVersion: '~5.4.0',
  license: 'MIT',
  name: 'cdk-amazon-connect-constructs',
  packageName: 'cdk-amazon-connect-constructs',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/karthiksenv/cdk-amazon-connect-constructs.git',
  publishToPypi: {
    distName: 'cdk-amazon-connect-constructs',
    module: 'cdk_amazon_connect_constructs',
  },
  publishToMaven: {
    javaPackage: 'io.github.karthik.cdk.connect',
    mavenGroupId: 'io.github.karthik',
    mavenArtifactId: 'cdk-amazon-connect-constructs',
  },
});

project.synth();
