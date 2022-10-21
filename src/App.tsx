import ButtonBasic from 'components/Buttons/Basic';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioInputs, useVideosInputs } from './hooks/media-devices';
import {
  Container,
  Footer,
  FooterLeftSide,
  FooterRightSide,
  InfoButton,
  RecordingVideo,
  VideoArea,
  VideoPlaceholder,
  VideoPlaceholderText,
  VIDEO_AREA_PADDING,
  WarnMessage,
} from './styles';
import { BsCameraVideo, BsChevronDown, BsDownload } from 'react-icons/bs';
import { BiMicrophone } from 'react-icons/bi';
import { IoMdHelp, IoMdSettings } from 'react-icons/io';
import { VscClose } from 'react-icons/vsc';
import Theme from 'config/theme';
import RecordingButton from 'components/Buttons/RecordingButton';
import MediaDeviceSelector from 'components/MediaDeviceSelector';
import ReactTooltip from 'react-tooltip';
import { useStream } from 'hooks/stream';
import { getAudioStream, getVideoStream } from 'utils/streams';
import { useRequestWebcamAndMicrophonePermissions, WebcamAndMicrophoneStatuses } from 'hooks/permissions';
import AudioControl from 'components/AudioControl';
import { isMobile } from 'react-device-detect';
import { ToastContainer } from 'react-toastify';
import { Helmet } from 'react-helmet';

import 'react-toastify/dist/ReactToastify.css';
import MobileWarning from 'components/MobileWarning';
import ModalAbout, { useModalAbout } from 'components/ModalAbout';
import { useCalculateVideoHeightOnWindowResize } from 'hooks/layout';
import IconButton from 'components/Buttons/IconButton';

const defaultIconProps = { size: 20, color: Theme.pallet.primaryDark };
const DownArrayIcon = () => <BsChevronDown {...defaultIconProps} />;

function App() {
  const videoAreaRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const recordingBlob = useRef<Blob | null>(null);

  const [videoInputSelectorIsOpen, setVideoInputSelectorIsOpen] = useState(false);
  const [audioInputSelectorIsOpen, setAudioInputSelectorIsOpen] = useState(false);
  const [selectedAudioInput, setSelectedAudioInput] = useState<MediaDeviceInfo | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<MediaDeviceInfo | null>(null);
  const [isRecordingRunning, setIsRecordingRunning] = useState(false);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [downloadFileName, setDownloadFileName] = useState('file.webm');
  const [isDisplayResult, setIsDisplayResult] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isDisplayWarn, setIsDisplayWarn] = useState(true);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);

  const { modalAboutIsOpen, closeModalAbout, openModalAbout } = useModalAbout();

  const { audioInputs } = useAudioInputs();
  const { videosInputs } = useVideosInputs();

  const status = useRequestWebcamAndMicrophonePermissions();

  const calculateVideoHeight = useCallback(() => {
    if (!videoAreaRef.current) return;
    const height = videoAreaRef.current.getBoundingClientRect().height - VIDEO_AREA_PADDING * 2;
    setVideoHeight(height);
    
  }, []);

  const calculateVideoWidth = useCallback((videoHeightParam: number, streamParam: MediaStream | null) => {
    const settings = streamParam?.getVideoTracks()[0].getSettings();
    console.log('settings', settings);
    console.log('videoHeightParam', videoHeightParam);
    console.log('streamParam', streamParam);
    if (settings && videoHeightParam) {
      const width = videoHeightParam * (settings.aspectRatio || 16 / 9);
    setVideoWidth(width);
      
    }
  }, []);

  const setupStreamPreview = useCallback((streamToSetup: MediaStream | null) => {
    if (streamToSetup) setAudioStream(new MediaStream(streamToSetup.getAudioTracks()));
    else setAudioStream(null);

    const onlyVideo = new MediaStream(streamToSetup?.getVideoTracks() ?? []);
    if (videoRef.current) videoRef.current.srcObject = onlyVideo;
  }, []);

  const onStreamChange = useCallback(
    (stream: MediaStream | null) => {
      calculateVideoWidth(videoHeight, stream);
      setupStreamPreview(stream);
    },
    [calculateVideoWidth, setupStreamPreview, videoHeight]
  );

  const { stream, replaceVideoTracks, replaceAudioTracks, muteAudioTracks, unmuteAudioTracks } = useStream({
    onStreamChange,
  });

  useEffect(() => {
    const _video = videoRef.current;
    return () => {
      mediaRecorder.current?.stop();
      (_video?.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useCalculateVideoHeightOnWindowResize({
    calculateFn: calculateVideoHeight,
  });

  useEffect(() => {
    calculateVideoWidth(videoHeight, stream.current);
  }, [calculateVideoWidth, stream, videoHeight]);

  async function handleStartRecordingClick() {
    if (!selectedVideo) {
      alert('Is required select video input');
      return;
    }

    setIsDisplayResult(false);

    const previewVideoStream = videoRef.current!.srcObject as MediaStream;

    if (selectedAudioInput) {
      const audioStream = await getAudioStream(selectedAudioInput);
      replaceAudioTracks(audioStream);
    }
    if (!previewVideoStream.active) {
      const videoStream = await getVideoStream(selectedVideo);
      replaceVideoTracks(videoStream);
    }

    mediaRecorder.current = new MediaRecorder(stream.current!);
    mediaRecorder.current.addEventListener('dataavailable', handleMediaRecorderDataAvailable);
    mediaRecorder.current.addEventListener('stop', handleMediaRecorderStop);
    mediaRecorder.current.start(1000);
    setIsRecordingRunning(true);

    function handleMediaRecorderDataAvailable(event: BlobEvent) {
      const chunk = event.data;
      recordingChunks.current.push(chunk);
      setRecordingTime((old) => old + 1);
    }

    function handleMediaRecorderStop() {
      const blob = new Blob(recordingChunks.current);
      recordingBlob.current = blob;
      const url = URL.createObjectURL(blob);
      console.log('url', url);
      console.log('blob', blob);
      console.log('recordingChunks', recordingChunks.current);
      setDownloadLink(url);
      console.log('downloadLink', downloadLink);
      console.log('mediaRecorder.current', mediaRecorder.current);
      setIsRecordingRunning(false);
      setDownloadFileName(`${new Date().toISOString()}.mp4`);
      console.log('Download link', `${new Date().toISOString()}.webm`);
      stream.current!.getTracks().forEach((track) => track.stop());
      console.log('stream.current', stream.current?.getVideoTracks());
      setRecordingTime(0);
      recordingChunks.current = [];
      mediaRecorder.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsDisplayResult(true);
    }
  }

  function handleStopRecording() {
    mediaRecorder.current?.stop();
  }

  function handleSelectVideoInput(videoInput: MediaDeviceInfo) {
    setVideoInputSelectorIsOpen(false);
    setSelectedVideo(videoInput);

    getVideoStream(videoInput).then(replaceVideoTracks);
  }

  function handleSelectAudioInput(audioInput: MediaDeviceInfo) {
    setAudioInputSelectorIsOpen(false);
    setSelectedAudioInput(audioInput);

    getAudioStream(audioInput).then(replaceAudioTracks);
  }

  function handlePauseAudioClick() {
    if (isAudioPaused) unmuteAudioTracks();
    else muteAudioTracks();

    setIsAudioPaused(!isAudioPaused);
  }

  function handleConfigureNextRecording() {
    setIsDisplayResult(false);
    setDownloadFileName('');
    setDownloadLink('');

    if (selectedVideo) getVideoStream(selectedVideo).then(replaceVideoTracks);
    if (selectedAudioInput) getAudioStream(selectedAudioInput).then(replaceAudioTracks);
  }

  function handleVideoAreaRef(ref: HTMLDivElement | null) {
    videoAreaRef.current = ref;
    if (videoHeight === 0) calculateVideoHeight();
  }

  if (isMobile) {
    return <MobileWarning />;
  }

  return (
    <Container>
      <ReactTooltip effect="solid" />
      <Helmet>
        <title>{isRecordingRunning ? 'Gravando...' : 'WebRecorder'}</title>
      </Helmet>
      <VideoArea ref={handleVideoAreaRef}>
        {selectedVideo || (isDisplayResult && downloadLink) ? (
          <VideoPlaceholder>
            <RecordingVideo
              src={isDisplayResult && downloadLink ? downloadLink : undefined}
              ref={videoRef}
              autoPlay={!isDisplayResult}
              controls={isDisplayResult}
              style={{ width: videoWidth, height: videoHeight }}
            />
          </VideoPlaceholder>
        ) : (
          <VideoPlaceholder>
            <VideoPlaceholderText>Selecione um vídeo</VideoPlaceholderText>
          </VideoPlaceholder>
        )}
        <InfoButton size={30} onClick={openModalAbout}>
          <IoMdHelp size={20} />
        </InfoButton>
      </VideoArea>
      {status === WebcamAndMicrophoneStatuses.Denied && isDisplayWarn && (
        <WarnMessage>
          <span>Sem permissão alguns dispositivos não aparecerão para serem selecionado</span>
          <button onClick={() => setIsDisplayWarn(false)}>
            <VscClose size={17} color="#555" />
          </button>
        </WarnMessage>
      )}
      <Footer>
        <FooterLeftSide>
          {!isDisplayResult && (
            <>
              <ButtonBasic
                LeftIcon={<BiMicrophone {...defaultIconProps} />}
                disabled={audioInputs.length === 0 || isRecordingRunning}
                label={selectedAudioInput?.label ?? 'Não selecionado'}
                onClick={() => setAudioInputSelectorIsOpen(true)}
                RightIcon={<DownArrayIcon />}
                width={200}
                maxWidth={250}
              />
              <ButtonBasic
                LeftIcon={<BsCameraVideo {...defaultIconProps} />}
                disabled={isRecordingRunning}
                label={selectedVideo?.label ?? 'Não selecionado'}
                RightIcon={<DownArrayIcon />}
                onClick={() => setVideoInputSelectorIsOpen(true)}
                width={200}
                maxWidth={250}
              />
            </>
          )}
          {isDisplayResult && downloadLink && (
            <>
              <ButtonBasic
                LeftIcon={<IoMdSettings {...defaultIconProps} />}
                label="Configurar outra gravação"
                onClick={handleConfigureNextRecording}
                width={200}
                maxWidth={250}
                labelAlign="center"
              />
              <IconButton size={50} asLink href={downloadLink} filenameDownload={downloadFileName}>
                <BsDownload {...defaultIconProps} />
              </IconButton>
            </>
          )}
        </FooterLeftSide>
        <FooterRightSide>
          {selectedAudioInput && audioStream && !isDisplayResult && (
            <AudioControl stream={audioStream} isPaused={isAudioPaused} onClick={handlePauseAudioClick} />
          )}
          {!isDisplayResult && (
            <RecordingButton
              onClick={isRecordingRunning ? handleStopRecording : handleStartRecordingClick}
              isRecording={isRecordingRunning}
              currentSeconds={recordingTime}
              data-tip={isRecordingRunning ? 'Parar' : 'Iniciar'}
            />
          )}
        </FooterRightSide>
      </Footer>
      <MediaDeviceSelector
        isOpen={videoInputSelectorIsOpen}
        devices={videosInputs}
        onClose={() => setVideoInputSelectorIsOpen(false)}
        onSelect={handleSelectVideoInput}
      />
      <MediaDeviceSelector
        isOpen={audioInputSelectorIsOpen}
        devices={audioInputs}
        onClose={() => setAudioInputSelectorIsOpen(false)}
        onSelect={handleSelectAudioInput}
      />
      <ModalAbout isOpen={modalAboutIsOpen} onClose={closeModalAbout} />
      <ToastContainer position="top-right" />
    </Container>
  );
}

export default App;
